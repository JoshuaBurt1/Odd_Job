// server/src/index.ts
import 'dotenv/config'; 
import express from 'express';
import { PrismaClient, Prisma, JobStatus } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import cors from 'cors';
import cron from 'node-cron';

console.log("Database Host:", process.env.DB_HOST);

const aivenConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    ssl: {
        rejectUnauthorized: process.env.NODE_ENV === 'production' ? true : false,
        ca: process.env.DB_SSL_CA ? process.env.DB_SSL_CA.replace(/\\n/g, '\n') : undefined,
    },
};

const pool = new Pool(aivenConfig);
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

const app = express();
app.use(express.json());
app.use(cors());

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

// --- AUTOMATED CLEANUP TASK ---
// 1. DATABASE PURGE: Deletes jobs that have been expired for x + days to keep the DB lean.
//cron.schedule("0 14 * * *", async () => {
cron.schedule("0 0 * * *", async () => {
  console.log("⏳ [DAILY CLEANUP] Checking for expired jobs...");
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7); // Change to -0 for testing without waiting 7 days
  
  try {
    const result = await prisma.job.deleteMany({
      where: {
        expiryDate: { lte: sevenDaysAgo }
      }
    });
    if (result.count > 0) {
      console.log(`[CLEANUP] Deleted ${result.count} expired jobs.`);
      broadcastUpdate({ type: "REFRESH_JOBS" });
    } else {
      console.log("[CLEANUP] No expired jobs found.");
    }
  } catch (err) {
    console.error("[CLEANUP ERROR]", err);
  }
}, {
  timezone: "America/Toronto" // Optional: Ensures it runs at midnight local time
});

// 2. LIVE UI SYNC: Runs every 15 minutes
// Detects jobs that expired in the last 15 mins and tells clients to hide them.
cron.schedule("*/15 * * * *", async () => {
  const now = new Date();
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

  try {
    const recentlyExpired = await prisma.job.findMany({
      where: {
        expiryDate: {
          gt: fifteenMinutesAgo,
          lte: now
        }
      },
      select: { id: true }
    });

    if (recentlyExpired.length > 0) {
      console.log(`[LIVE CLEANUP] Broadcasting removal of ${recentlyExpired.length} expired jobs.`);
      broadcastUpdate({ 
        type: "REMOVE_JOBS", 
        ids: recentlyExpired.map(j => j.id) 
      });
    }
  } catch (err) {
    console.error("[LIVE CLEANUP ERROR]", err);
  }
}, { timezone: "America/Toronto" });


// --- HELPER: Calculate Auto-Pay Target (End of the following day) ---
function calculateAutoPayDate(startDateStr: string | Date) {
  const target = new Date(startDateStr);
  
  // Simply add 1 day to reach the "following day"
  target.setDate(target.getDate() + 1);
  
  // Set expiration to the very last millisecond of that following day
  // This means at 00:00:00 of the day after, the job is officially expired.
  target.setHours(23, 59, 59, 999);
  return target;
}

// 3. AUTO-PAY CRON JOB
// Runs strictly at 00:00 (Midnight) every day
cron.schedule('0 0 * * *', async () => {
  try {
    const now = new Date().getTime();
    
    const awaitingJobs = await prisma.job.findMany({
      where: { status: JobStatus.AWAITING_EVALUATION },
      include: { worker: true }
    });

    const expiredJobs = awaitingJobs.filter(job => {
      if (!job.evaluationStartedAt) return false;
      const targetDate = calculateAutoPayDate(job.evaluationStartedAt);
      return now >= targetDate.getTime();
    });

    if (expiredJobs.length === 0) return;

    for (const job of expiredJobs) {
      const workerId = job.workerId;
      if (!workerId) continue; 
      
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const completedJob = await tx.completedJob.create({
          data: {
            title: job.title,
            type: job.type,
            description: job.description,
            price: job.price,
            seekerId: job.seekerId,
            workerId: workerId,
            originalCreatedAt: job.createdAt
          }
        });
        await tx.job.delete({ where: { id: job.id } });
        console.log(`[PAYPAL API] Auto-releasing funds: $${completedJob.price}`);
      });
    }

    broadcastUpdate({ type: "REFRESH_JOBS" });
    console.log(`🧹 Auto-approved ${expiredJobs.length} jobs.`);
  } catch (error) {
    console.error("Auto-approve cron job failed:", error);
  }
}, { timezone: "America/Toronto" });

// --- REAL-TIME SSE LOGIC ---
let clients: any[] = [];

const broadcastUpdate = (data: any) => {
  clients.forEach(client => client.write(`data: ${JSON.stringify(data)}\n\n`));
};

app.get('/api/jobs/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(': connected\n\n'); 

  clients.push(res);

  req.on('close', () => {
    clients = clients.filter(client => client !== res);
  });
});

// --- AUTH & USER ENDPOINTS ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, address, userLat, userLong } = req.body;
    const user = await prisma.user.create({
      data: { name, email, password, address, userLat, userLong }
    });
    res.json({ id: user.id, email: user.email, name: user.name });
  } catch (error) {
    console.error("Registration Error:", error);
    res.status(400).json({ error: "Registration failed. Database connection or duplicate email issue." });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    res.json({ id: user.id, email: user.email, name: user.name });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Login failed due to server error" });
  }
});

app.get('/api/users/:id/profile', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        workerArchive: {
          include: { 
            seeker: { select: { id: true, name: true } },
            reviews: { select: { authorId: true } }
          },
          orderBy: { completedAt: 'desc' }
        },
        seekerArchive: {
          include: { 
            worker: { select: { id: true, name: true } },
            reviews: { select: { authorId: true } }
          },
          orderBy: { completedAt: 'desc' }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const completedJobs = user.workerArchive.length;
    const earnings = user.workerArchive.reduce((total, job) => total + job.price, 0);

    // Injecting all the new User model fields
    res.json({
      name: user.name,
      email: user.email,
      paymentId: user.paymentId,
      address: user.address,
      userLat: user.userLat,
      userLong: user.userLong,
      seekerRating: user.seekerRating,
      seekerReviewCount: user.seekerReviewCount,
      workerRating: user.workerRating,
      workerReviewCount: user.workerReviewCount,
      createdAt: user.createdAt,
      completedJobs,
      earnings,
      workerComplete: user.workerArchive,
      seekerComplete: user.seekerArchive
    });
  } catch (error) {
    console.error("Profile Fetch Error:", error);
    res.status(500).json({ error: "Failed to fetch profile data" });
  }
});

app.put('/api/users/:id/location', async (req, res) => {
  try {
    const { address, userLat, userLong } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { address, userLat, userLong }
    });
    res.json({ message: "Location updated successfully", user });
  } catch (error) {
    console.error("Location Update Error:", error);
    res.status(500).json({ error: "Failed to update location" });
  }
});

app.put('/api/users/:id/payment', async (req, res) => {
  try {
    const { paymentId } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { paymentId }
    });
    res.json({ message: "Payment details updated successfully", user });
  } catch (error) {
    console.error("Payment Update Error:", error);
    res.status(500).json({ error: "Failed to update payment details" });
  }
});

app.get('/api/users/:id/public-profile', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        // Include the actual reviews received by this user
        seekerReviews: {
          include: { 
            author: { select: { name: true } },
            job: { select: { title: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        workerReviews: {
          include: { 
            author: { select: { name: true } },
            job: { select: { title: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        workerArchive: {
          include: { 
            seeker: { 
              select: { 
                id: true,
                name: true 
              } 
            } 
          },
          orderBy: { completedAt: 'desc' }
        },
        seekerArchive: {
          include: { 
            worker: { 
              select: { 
                id: true,
                name: true 
              } 
            } 
          },
          orderBy: { completedAt: 'desc' }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Expose ONLY safe, non-sensitive fields
    res.json({
      id: user.id,
      name: user.name,
      seekerRating: user.seekerRating,
      seekerReviewCount: user.seekerReviewCount,
      workerRating: user.workerRating,
      workerReviewCount: user.workerReviewCount,
      createdAt: user.createdAt,
      seekerReviews: user.seekerReviews,
      workerReviews: user.workerReviews,
      completedJobs: user.workerArchive.length,
      
      workerComplete: user.workerArchive.map(job => ({
        id: job.id,
        title: job.title,
        completedAt: job.completedAt,
        seeker: job.seeker
      })),
      seekerComplete: user.seekerArchive.map(job => ({
        id: job.id,
        title: job.title,
        completedAt: job.completedAt,
        worker: job.worker
      }))
    });
  } catch (error) {
    console.error("Public Profile Fetch Error:", error);
    res.status(500).json({ error: "Failed to fetch public profile" });
  }
});

app.get('/api/users/:id/active-job', async (req, res) => {
  try {
    const activeJob = await prisma.job.findFirst({
      where: {
        workerId: req.params.id,
        status: { in: [JobStatus.ACCEPTED, JobStatus.AWAITING_EVALUATION] }
      },
      select: { id: true, title: true }
    });
    res.json({ activeJob });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch active job" });
  }
});

// --- JOB ENDPOINTS ---
app.post('/api/jobs', async (req, res) => {
  try {
    const { title, type, description, price, seekerId, timezone, startDate, expiryDate, address, lat, lng, radius } = req.body;
    
    const job = await prisma.job.create({
      data: { 
        title, 
        type, 
        description, 
        price: parseFloat(price), 
        seekerId,
        timezone: timezone || "UTC",
        startDate: new Date(startDate),
        expiryDate: new Date(expiryDate),
        address,
        lat,
        lng,
        radius: radius ? parseFloat(radius) : null
      }
    });

    broadcastUpdate({ type: "REFRESH_JOBS" });
    res.json(job);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create job" });
  }
});

app.get('/api/jobs', async (req, res) => {
  const { userId } = req.query;
  const now = new Date();

  try {
    const jobs = await prisma.job.findMany({ 
      where: userId ? {
        OR: [
          { status: JobStatus.OPEN, expiryDate: { gt: now } },
          { seekerId: String(userId) },
          { workerId: String(userId) }
        ]
      } : { 
        status: JobStatus.OPEN,
        expiryDate: { gt: now }
      },
      include: {
        worker: { select: { name: true } },
        seeker: { 
          select: { 
            id: true,
            name: true,
            seekerRating: true,
            seekerReviewCount: true 
          } 
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

app.get('/api/jobs/:id', async (req, res) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        worker: { select: { name: true } },
        seeker: { 
          select: { 
            id: true,
            name: true,
            seekerRating: true,
            seekerReviewCount: true 
          } 
        }
      }
    });
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

app.put('/api/jobs/:id', async (req, res) => {
  try {
    const { title, type, description, price, timezone, startDate, expiryDate, address, lat, lng, radius } = req.body;
    
    const job = await prisma.job.update({
      where: { id: req.params.id },
      data: {
        title,
        type,
        description,
        price: parseFloat(price),
        timezone: timezone || "UTC",
        startDate: new Date(startDate),
        expiryDate: new Date(expiryDate),
        address,
        lat,
        lng,
        radius: radius ? parseFloat(radius) : null
      }
    });

    broadcastUpdate({ type: "REFRESH_JOBS" });
    res.json(job);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update job" });
  }
});

app.delete('/api/jobs/:id', async (req, res) => {
  const { userId } = req.body;
  const jobId = req.params.id;

  try {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return res.status(404).json({ error: "Job not found." });
    }
    
    if (job.seekerId !== userId) {
      return res.status(403).json({ error: "Unauthorized. Only the user who posted the job can delete it." });
    }

    await prisma.job.delete({ where: { id: jobId } });
    
    broadcastUpdate({ type: "REFRESH_JOBS" });
    res.json({ message: "Job successfully deleted." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete job." });
  }
});

app.post('/api/jobs/:id/accept', async (req, res) => {
  const { workerId, workerLat, workerLng } = req.body; 
  const jobId = req.params.id;

  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const activeJob = await tx.job.findFirst({
        where: {
          workerId: workerId,
          status: { in: [JobStatus.ACCEPTED, JobStatus.AWAITING_EVALUATION] }
        }
      });
      
      if (activeJob) {
        throw new Error("You already have an active job. Complete or cancel it first.");
      }
      const job = await tx.job.findUnique({ where: { id: jobId } });
      
      if (!job || job.status !== JobStatus.OPEN) throw new Error("Job is no longer available.");
      if (job.seekerId === workerId) throw new Error("You cannot accept a job you posted.");
      
      if (job.radius && job.lat && job.lng) {
        if (!workerLat || !workerLng) {
          throw new Error("Location access is required to apply for this job.");
        }
        const distance = getDistance(job.lat, job.lng, workerLat, workerLng);
        if (distance > job.radius) {
          throw new Error(`You are too far away (${distance.toFixed(1)}km). Max radius is ${job.radius}km.`);
        }
      }
      if (new Date() > job.expiryDate) throw new Error("This job posting has expired.");

      return await tx.job.update({
        where: { id: jobId },
        data: { status: JobStatus.ACCEPTED, workerId }
      });
    });
    broadcastUpdate({ type: "REFRESH_JOBS" });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/jobs/:id/cancel', async (req, res) => {
  const { workerId } = req.body;
  const jobId = req.params.id;

  try {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job || job.workerId !== workerId) throw new Error("Unauthorized to cancel this job.");

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: { status: JobStatus.OPEN, workerId: null }
    });
    broadcastUpdate({ type: "REFRESH_JOBS" });
    res.json(updatedJob);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/jobs/:id/complete', async (req, res) => {
  try {
    const job = await prisma.job.update({
      where: { id: req.params.id },
      data: { 
        status: JobStatus.AWAITING_EVALUATION,
        evaluationStartedAt: new Date()
      },
      include: { worker: true }
    });
    broadcastUpdate({ type: "REFRESH_JOBS" });
    res.json({ message: "Job submitted for evaluation.", job });
  } catch (error) {
    res.status(500).json({ error: "Failed to submit job for evaluation." });
  }
});

app.post('/api/jobs/:id/approve', async (req, res) => {
  const jobId = req.params.id;

  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const job = await tx.job.findUnique({ where: { id: jobId }, include: { worker: true } });
      
      if (!job || !job.workerId) {
        throw new Error("Job not found or worker missing.");
      }

      const completedJob = await tx.completedJob.create({
        data: {
          title: job.title,
          type: job.type,
          description: job.description,
          price: job.price,
          seekerId: job.seekerId,
          workerId: job.workerId,
          originalCreatedAt: job.createdAt
        }
      });

      await tx.job.delete({ where: { id: jobId } });

      return { completedJob, worker: job.worker };
    });

    broadcastUpdate({ type: "REFRESH_JOBS" });
    
    console.log(`[PAYPAL API] Releasing funds: $${result.completedJob.price} to routing ID: ${result.worker?.paymentId || 'DEFAULT_TEST_ID'}`);
    
    res.json({ message: "Job completed, archived, and paid successfully.", job: result.completedJob });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to approve job." });
  }
});

app.post('/api/jobs/:id/reject', async (req, res) => {
  try {
    const job = await prisma.job.update({
      where: { id: req.params.id },
      data: { 
        status: JobStatus.ACCEPTED,
        evaluationStartedAt: null // <-- ADD THIS LINE
      }, 
      include: { worker: true }
    });
    broadcastUpdate({ type: "REFRESH_JOBS" });
    res.json({ message: "Job returned to worker for improvements.", job });
  } catch (error) {
    res.status(500).json({ error: "Failed to reject job." });
  }
});

// POST /api/reviews - Create a review and update user ratings
app.post('/api/reviews', async (req, res) => {
  const { jobId, targetId, role, authorId, rating, comment } = req.body;

  try {
    // 1. Start a transaction to ensure rating updates and review creation happen together
    const result = await prisma.$transaction(async (tx) => {
      
      // 2. Create the Review
      const newReview = await tx.review.create({
        data: {
          rating: Number(rating),
          comment,
          jobId,
          authorId,
          // If role is seeker, the user being reviewed is the seeker
          ...(role === 'seeker' ? { seekerId: targetId } : { workerId: targetId }),
        },
      });

      // 3. Get the target user to calculate the new average
      const targetUser = await tx.user.findUnique({
        where: { id: targetId },
        select: {
          seekerRating: true,
          seekerReviewCount: true,
          workerRating: true,
          workerReviewCount: true,
        }
      });

      if (!targetUser) throw new Error("Target user not found");

      // 4. Calculate new average based on the role being reviewed
      if (role === 'seeker') {
        const newCount = targetUser.seekerReviewCount + 1;
        const newAverage = ((targetUser.seekerRating * targetUser.seekerReviewCount) + rating) / newCount;

        await tx.user.update({
          where: { id: targetId },
          data: {
            seekerRating: newAverage,
            seekerReviewCount: newCount,
          },
        });
      } else {
        const newCount = targetUser.workerReviewCount + 1;
        const newAverage = ((targetUser.workerRating * targetUser.workerReviewCount) + rating) / newCount;

        await tx.user.update({
          where: { id: targetId },
          data: {
            workerRating: newAverage,
            workerReviewCount: newCount,
          },
        });
      }

      return newReview;
    });

    res.json(result);
  } catch (error: any) {
    console.error("Review Submission Error:", error);
    res.status(500).json({ error: error.message || "Failed to submit review" });
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`🚀 Oddjob API running on http://localhost:${PORT}`);
});
// server/src/index.ts
import 'dotenv/config'; 
import express from 'express';
import { PrismaClient, Prisma, JobStatus } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import cors from 'cors';

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
setInterval(async () => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  try {
    const result = await prisma.job.deleteMany({
      where: {
        expiryDate: { lte: sevenDaysAgo }
      }
    });
    if (result.count > 0) {
      console.log(`[CLEANUP] Deleted ${result.count} expired jobs.`);
      broadcastUpdate({ type: "REFRESH_JOBS" });
    }
  } catch (err) {
    console.error("[CLEANUP ERROR]", err);
  }
}, 1000 * 60 * 60);

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
          include: { seeker: { select: { id: true, name: true } } },
          orderBy: { completedAt: 'desc' }
        },
        seekerArchive: {
          include: { worker: { select: { id: true, name: true } } },
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
      data: { status: JobStatus.AWAITING_EVALUATION },
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
      data: { status: JobStatus.ACCEPTED }, 
      include: { worker: true }
    });
    broadcastUpdate({ type: "REFRESH_JOBS" });
    res.json({ message: "Job returned to worker for improvements.", job });
  } catch (error) {
    res.status(500).json({ error: "Failed to reject job." });
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`🚀 Oddjob API running on http://localhost:${PORT}`);
});
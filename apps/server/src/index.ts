// server/src/index.ts
import 'dotenv/config'; 
import express from 'express';
import { RequestHandler } from 'express';
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

// PayPal API credentials from environment variables
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_APP_SECRET = process.env.PAYPAL_APP_SECRET;
const PAYPAL_API_BASE = process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";

// Internal helper for server-side PayPal calls
async function generatePayPalAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_APP_SECRET}`).toString("base64");
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    body: "grant_type=client_credentials",
    headers: { 
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded" 
    },
  });
  const data = await response.json();
  return data.access_token;
}

// --- PAYPAL HELPERS ---

/**
 * Calculates the exact standard PayPal domestic fee deduction
 * Used for logging and payouts when we don't have the live capture object
 */
const calculateNetAmount = (grossPrice: number) => {
  return Number((grossPrice - (grossPrice * 0.029 + 0.30)).toFixed(2));
};

/**
 * Captures an order created by the frontend PayPal SDK.
 * Moves money from Seeker to the Platform immediately.
 */
async function capturePayPalOrder(orderID: string) {
  const accessToken = await generatePayPalAccessToken();

  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderID}/capture`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("PayPal Capture Error:", data);
    throw new Error("Failed to capture PayPal order.");
  }

  // Extract capture details including exact fee breakdown
  const capture = data.purchase_units[0].payments.captures[0];
  const captureId = capture.id;
  const gross = parseFloat(capture.amount.value);
  const fee = parseFloat(capture.seller_receivable_breakdown.paypal_fee.value);
  const net = parseFloat(capture.seller_receivable_breakdown.net_amount.value);

  console.log(`[PAYPAL API] Escrow Received: Gross $${gross.toFixed(2)} | Fee $${fee.toFixed(2)} | Net Landed $${net.toFixed(2)}`);

  return { data, captureId, net };
}

/**
 * Refunds a previously captured payment.
 * If 'amount' is provided, it does a partial refund. If omitted, it refunds the full amount.
 */
async function refundPayPalPayment(captureId: string, amount?: number) {
  const accessToken = await generatePayPalAccessToken();
  
  const payload = amount ? { 
    amount: { value: amount.toFixed(2), currency_code: "CAD" }
  } : {};

  const response = await fetch(`${PAYPAL_API_BASE}/v2/payments/captures/${captureId}/refund`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("PayPal Refund Error:", errorData);
    throw new Error("Failed to process PayPal refund.");
  }

  return await response.json();
}

/**
 * Sends money from the Platform's Sandbox balance to the Worker's PayPal email.
 */
async function sendPayPalPayout(workerEmail: string, amount: number, jobTitle: string) {
  const accessToken = await generatePayPalAccessToken();
  
  const payoutPayload = {
    sender_batch_header: {
      sender_batch_id: `batch_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      email_subject: `Payment for: ${jobTitle}`,
      email_message: `You received $${amount.toFixed(2)} for completing "${jobTitle}" on Oddjob!`,
    },
    items: [
      {
        recipient_type: "EMAIL",
        amount: {
          value: amount.toFixed(2), // PayPal requires string/2 decimal places
          currency: "CAD",
        },
        note: `Oddjob completion: ${jobTitle}`,
        receiver: workerEmail,
      },
    ],
  };

  const response = await fetch(`${PAYPAL_API_BASE}/v1/payments/payouts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payoutPayload),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("PayPal Payout Error:", errorData);
    throw new Error("PayPal Payout Failed");
  }

  return await response.json();
}

/**
 * Middleware to ensure the user has a configured paymentId.
 * Assumes the user is passing the userId in the request, either 
 * via an authorization header, session, or request body.
 */
const requirePaymentSetup: RequestHandler<{ id?: string }> = async (req, res, next) => {
  try {
    const userId = (req.headers['x-user-id'] as string) || req.body.seekerId || req.body.workerId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: User ID required." });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { paymentId: true }
    });

    if (!user || !user.paymentId || user.paymentId.trim() === "") {
      return res.status(403).json({ 
        error: "Action denied.", 
        reason: "PAYMENT_SETUP_REQUIRED",
        message: "You must set up your PayPal or Stripe routing details in your profile before continuing." 
      });
    }

    next();
  } catch (error) {
    console.error("Payment Validation Error:", error);
    res.status(500).json({ error: "Internal server error during validation." });
  }
};

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
// 1. DATABASE PURGE: Refunds seekers and deletes jobs that have been expired for x + days.
cron.schedule("0 0 * * *", async () => {
  console.log("⏳ [DAILY CLEANUP] Checking for expired jobs...");
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7); // Change to -0 for testing without waiting 7 days
  
  try {
    const expiredJobs = await prisma.job.findMany({
      where: {
        expiryDate: { lte: sevenDaysAgo },
        status: JobStatus.OPEN // Prevents purging ACCEPTED or AWAITING_EVALUATION jobs
      }
    });

    if (expiredJobs.length > 0) {
      let deletedCount = 0;
      for (const job of expiredJobs) {
        // Refund the seeker before purging
        if (job.paypalCaptureId) {
          try {
            await refundPayPalPayment(job.paypalCaptureId);
            const netAmount = calculateNetAmount(job.price);
            console.log(`[PAYPAL API] Escrow Decremented (-$${netAmount.toFixed(2)}) | Seeker Incremented (+$${job.price.toFixed(2)}) | Auto-Purge Refund (CaptureID: ${job.paypalCaptureId})`);
          } catch (refundErr) {
            console.error(`[CLEANUP] Failed to refund job ${job.id}:`, refundErr);
          }
        }
        
        await prisma.job.delete({ where: { id: job.id } });
        deletedCount++;
      }
      console.log(`[CLEANUP] Refunded and deleted ${deletedCount} expired jobs.`);
      broadcastUpdate({ type: "REFRESH_JOBS" });
    } else {
      console.log("[CLEANUP] No expired jobs found.");
    }
  } catch (err) {
    console.error("[CLEANUP ERROR]", err);
  }
}, {
  timezone: "America/Toronto"
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
  target.setDate(target.getDate() + 0);
  
  // Set expiration to the very last millisecond of that following day
  // This means at 00:00:00 of the day after, the job is officially expired.
  target.setHours(23, 59, 59, 999);
  return target;
}

// --- AUTO-PAY CRON JOB ---
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
      const workerEmail = job.worker?.paymentId;
      
      if (!workerId || !workerEmail) {
        console.warn(`[AUTO-PAY] Skipping job ${job.id}: Worker Payment ID missing.`);
        continue; 
      }
      
      try {
        const netAmount = calculateNetAmount(job.price);
        console.log(`[PAYPAL API] Auto-releasing Escrow: Escrow Decremented (-$${netAmount.toFixed(2)}) | Worker Incremented (+$${netAmount.toFixed(2)}) to ${workerEmail}`);
        
        // Payout the true NET amount
        await sendPayPalPayout(workerEmail, netAmount, job.title);

        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          await tx.completedJob.create({
            data: {
              title: job.title,
              type: job.type,
              description: job.description,
              price: job.price,
              seekerId: job.seekerId,
              workerId: workerId,
              originalCreatedAt: job.createdAt,
              paypalCaptureId: job.paypalCaptureId
            }
          });
          await tx.job.delete({ where: { id: job.id } });
        });
      } catch (err) {
        console.error(`[AUTO-PAY FATAL] Could not process transaction for job ${job.id}:`, err);
      }
    }

    broadcastUpdate({ type: "REFRESH_JOBS" });
    console.log(`🧹 Auto-approved and processed payments for ${expiredJobs.length} jobs.`);
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
        _count: {
          select: {
            seekerReviews: true,
            workerReviews: true,
          }
        },
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
    
    // Calculate accurate actual earnings post-fees using the net helper
    const earnings = user.workerArchive.reduce((total, job) => total + calculateNetAmount(job.price), 0);

    res.json({
      name: user.name,
      email: user.email,
      paymentId: user.paymentId,
      address: user.address,
      userLat: user.userLat,
      userLong: user.userLong,
      seekerRating: user.seekerRating,
      seekerReviewCount: user._count.seekerReviews,
      workerRating: user.workerRating,
      workerReviewCount: user._count.workerReviews,
      createdAt: user.createdAt,
      completedJobs,
      earnings, // Now reflects the true landed amount
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
    
    // Basic validation: Is it a valid email?
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(paymentId)) {
      return res.status(400).json({ error: "Please enter a valid PayPal email address." });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { paymentId }
    });
    res.json({ message: "PayPal email updated successfully", user });
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
        _count: {
          select: {
            seekerReviews: true,
            workerReviews: true,
          }
        },
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
      seekerReviewCount: user._count.seekerReviews,
      workerRating: user.workerRating,
      workerReviewCount: user._count.workerReviews,
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


app.get('/api/users/:id/can-post', requirePaymentSetup, (req, res) => {
//app.get('/api/users/:id/can-post', (req, res) => {
  return res.json({ allowed: true });
});

// --- JOB ENDPOINTS ---
app.post('/api/jobs', async (req, res) => {
  try {
    const { orderID, title, type, description, price, seekerId, timezone, startDate, expiryDate, address, lat, lng, radius } = req.body;
    
    if (!orderID) {
      return res.status(400).json({ error: "PayPal orderID is required to post a job." });
    }

    // 1. Capture the funds immediately (Escrow)
    const { captureId, net } = await capturePayPalOrder(orderID);

    // TEST: Post Job -> Escrow increments (Net), Seeker decrements (Gross)
    console.log(`[PAYPAL API] Escrow Incremented (+$${net.toFixed(2)}) | Seeker Decremented (-$${parseFloat(price).toFixed(2)}) | CaptureID: ${captureId}`);

    // 2. Save the job and the captureId to the database (Store gross price)
    const job = await prisma.job.create({
      data: { 
        title, type, description, price: parseFloat(price), seekerId,
        timezone: timezone || "UTC",
        startDate: new Date(startDate),
        expiryDate: new Date(expiryDate),
        address, lat, lng,
        radius: radius ? parseFloat(radius) : null,
        paypalCaptureId: captureId 
      }
    });

    broadcastUpdate({ type: "REFRESH_JOBS" });
    res.json(job);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create job or capture payment." });
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
            // 1. Get the real-time count from the reviews table
            _count: {
              select: { seekerReviews: true }
            }
          } 
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 2. Map the results to flatten the count for the frontend
    const flattenedJobs = jobs.map(job => ({
      ...job,
      seeker: job.seeker ? {
        ...job.seeker,
        seekerReviewCount: job.seeker._count.seekerReviews
      } : null
    }));

    res.json(flattenedJobs);
  } catch (error) {
    console.error("Fetch Jobs Error:", error);
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
            // 1. Get the real-time count
            _count: {
              select: { seekerReviews: true }
            }
          } 
        }
      }
    });

    if (!job) return res.status(404).json({ error: "Job not found" });

    // 2. Flatten the count before sending to frontend
    const response = {
      ...job,
      seeker: job.seeker ? {
        ...job.seeker,
        seekerReviewCount: job.seeker._count.seekerReviews
      } : null
    };

    res.json(response);
  } catch (error) {
    console.error("Fetch Job Detail Error:", error);
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

app.put('/api/jobs/:id', async (req, res) => {
  try {
    const { newOrderID, title, type, description, price, timezone, startDate, expiryDate, address, lat, lng, radius } = req.body;
    const newPrice = parseFloat(price);
    
    const existingJob = await prisma.job.findUnique({ where: { id: req.params.id } });
    if (!existingJob) return res.status(404).json({ error: "Job not found" });

    let finalCaptureId = existingJob.paypalCaptureId;

    if (newPrice < existingJob.price && existingJob.paypalCaptureId) {
      // 1. Price decreased: Issue a partial refund
      const refundAmount = existingJob.price - newPrice;
      const netRefundImpact = calculateNetAmount(refundAmount);
      await refundPayPalPayment(existingJob.paypalCaptureId, refundAmount);

      console.log(`[PAYPAL API] Escrow Decremented (-$${netRefundImpact.toFixed(2)}) | Seeker Incremented (+$${refundAmount.toFixed(2)}) | Partial Refund for CaptureID: ${existingJob.paypalCaptureId}`);
      
    } else if (newPrice > existingJob.price && existingJob.paypalCaptureId) {
      // 2. Price increased: Require new order, refund old order entirely
      if (!newOrderID) {
        return res.status(400).json({ error: "Price increase requires a new PayPal orderID from the frontend." });
      }
      
      const { captureId, net: newNet } = await capturePayPalOrder(newOrderID);
      finalCaptureId = captureId;

      console.log(`[PAYPAL API] Escrow Incremented (+$${newNet.toFixed(2)}) | Seeker Decremented (-$${newPrice.toFixed(2)}) | New CaptureID: ${captureId}`);

      await refundPayPalPayment(existingJob.paypalCaptureId);
      const oldNetImpact = calculateNetAmount(existingJob.price);

      console.log(`[PAYPAL API] Escrow Decremented (-$${oldNetImpact.toFixed(2)}) | Seeker Incremented (+$${existingJob.price.toFixed(2)}) | Full Refund of Old CaptureID: ${existingJob.paypalCaptureId}`);
    }

    const job = await prisma.job.update({
      where: { id: req.params.id },
      data: {
        title, type, description, price: newPrice,
        timezone: timezone || "UTC",
        startDate: new Date(startDate),
        expiryDate: new Date(expiryDate),
        address, lat, lng,
        radius: radius ? parseFloat(radius) : null,
        paypalCaptureId: finalCaptureId
      }
    });

    broadcastUpdate({ type: "REFRESH_JOBS" });
    res.json(job);
  } catch (error: any) {
    console.error("Modify Job Error:", error);
    res.status(500).json({ error: error.message || "Failed to update job or process payment modification." });
  }
});


app.delete('/api/jobs/:id', async (req, res) => {
  const { userId } = req.body;
  const jobId = req.params.id;

  try {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ error: "Job not found." });
    if (job.seekerId !== userId) return res.status(403).json({ error: "Unauthorized." });

    if (job.paypalCaptureId) {
      await refundPayPalPayment(job.paypalCaptureId);
      const netAmount = calculateNetAmount(job.price);
      console.log(`[PAYPAL API] Escrow Decremented (-$${netAmount.toFixed(2)}) | Seeker Incremented (+$${job.price.toFixed(2)}) | Cancelled Job Refund (CaptureID: ${job.paypalCaptureId})`);
    }

    await prisma.job.delete({ where: { id: jobId } });
    
    broadcastUpdate({ type: "REFRESH_JOBS" });
    res.json({ message: "Job successfully deleted and funds refunded." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete job or process refund." });
  }
});

app.post('/api/jobs/:id/accept', requirePaymentSetup, async (req, res) => {
// app.post('/api/jobs/:id/accept', async (req, res) => {
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

// --- MANUAL APPROVE API ---
app.post('/api/jobs/:id/approve', async (req, res) => {
  const jobId = req.params.id;

  try {
    const job = await prisma.job.findUnique({ 
      where: { id: jobId }, 
      include: { worker: true } 
    });
    
    if (!job || !job.worker?.paymentId) {
      return res.status(400).json({ error: "Job or worker payment details missing." });
    }

    const netAmount = calculateNetAmount(job.price);
    console.log(`[PAYPAL API] Releasing Escrow funds: Escrow Decremented (-$${netAmount.toFixed(2)}) | Worker Incremented (+$${netAmount.toFixed(2)}) to ${job.worker.paymentId}`);
    
    // Send the NET amount to the worker
    await sendPayPalPayout(job.worker.paymentId, netAmount, job.title);

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const completedJob = await tx.completedJob.create({
        data: {
          title: job.title,
          type: job.type,
          description: job.description,
          price: job.price, // Preserve gross in DB for history
          seekerId: job.seekerId,
          workerId: job.workerId!,
          originalCreatedAt: job.createdAt,
          paypalCaptureId: job.paypalCaptureId
        }
      });

      await tx.job.delete({ where: { id: jobId } });
      return completedJob;
    });

    broadcastUpdate({ type: "REFRESH_JOBS" });
    res.json({ message: "Job approved and worker paid.", job: result });
  } catch (error: any) {
    console.error("Approval Error:", error);
    res.status(500).json({ error: error.message || "Failed to process approval and payment." });
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

      // 2. Fetch ALL reviews for this user to get a 100% accurate count and average
      const stats = await tx.review.aggregate({
        where: role === 'seeker' ? { seekerId: targetId } : { workerId: targetId },
        _count: true,
        _avg: {
          rating: true
        }
      });

      const newCount = stats._count;
      const newAverage = stats._avg.rating || 0;

      // 3. Update the user with the bulletproof numbers
      await tx.user.update({
        where: { id: targetId },
        data: {
          [role === 'seeker' ? 'seekerRating' : 'workerRating']: newAverage,
          [role === 'seeker' ? 'seekerReviewCount' : 'workerReviewCount']: newCount,
        },
      });

      return newReview;
    });

    res.json(result);
  } catch (error: any) {
    console.error("Review Submission Error:", error);
    res.status(500).json({ error: error.message || "Failed to submit review" });
  }
});

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Oddjob API running on port ${PORT}`);
});
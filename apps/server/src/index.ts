import 'dotenv/config'; 
import express from 'express';
import { PrismaClient, Prisma, JobStatus } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import cors from 'cors';

const aivenConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    ssl: {
        rejectUnauthorized: true,
        // Added the replace function back to properly parse the multiline cert
        ca: process.env.DB_SSL_CA ? process.env.DB_SSL_CA.replace(/\\n/g, '\n') : undefined,
    },
};

const pool = new Pool(aivenConfig);
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

const app = express();
app.use(express.json());
app.use(cors());

// --- ENDPOINTS ---

app.post('/api/jobs', async (req, res) => {
  try {
    const { title, type, description, price, seekerId } = req.body;
    const job = await prisma.job.create({
      data: { 
        title, 
        type, 
        description, 
        price: parseFloat(price), 
        seekerId 
      }
    });
    res.json(job);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create job" });
  }
});

app.get('/api/jobs/open', async (req, res) => {
  try {
    // Replaced 'OPEN' with Enum
    const jobs = await prisma.job.findMany({ where: { status: JobStatus.OPEN } });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

app.post('/api/jobs/:id/accept', async (req, res) => {
  const { workerId, paymentId } = req.body;
  const jobId = req.params.id;

  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const job = await tx.job.findUnique({ where: { id: jobId } });
      
      // Replaced 'OPEN' with Enum
      if (!job || job.status !== JobStatus.OPEN) {
        throw new Error("Job is no longer available.");
      }

      return await tx.job.update({
        where: { id: jobId },
        data: { 
          status: JobStatus.ACCEPTED, // Replaced 'ACCEPTED' with Enum
          workerId,
          // Storing worker payment info at the time of acceptance
          // Note: paymentId needs to be added to the Job model in schema if you intend to save it here
        }
      });
    });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/jobs/:id/complete', async (req, res) => {
  try {
    const job = await prisma.job.update({
      where: { id: req.params.id },
      data: { status: JobStatus.COMPLETED }, // Replaced 'COMPLETED' with Enum
      include: { worker: true }
    });
    
    // Using the worker relation to get the paymentId
    console.log(`Processing payment of $${job.price} to worker payment ID: ${job.worker?.paymentId}`);

    res.json({ message: "Job completed and paid successfully.", job });
  } catch (error) {
    res.status(500).json({ error: "Failed to complete job" });
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`🚀 Oddjob API running on http://localhost:${PORT}`);
});
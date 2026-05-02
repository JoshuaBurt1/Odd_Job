import 'dotenv/config'; 
import express from 'express';
import { PrismaClient, Prisma, JobStatus } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import cors from 'cors';

// Debugging check
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

// --- AUTH ENDPOINTS ---

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    const user = await prisma.user.create({
      data: { name, email, password }
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

// --- JOB ENDPOINTS ---

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
    const jobs = await prisma.job.findMany({ where: { status: JobStatus.OPEN } });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

app.post('/api/jobs/:id/accept', async (req, res) => {
  const { workerId } = req.body;
  const jobId = req.params.id;

  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const job = await tx.job.findUnique({ where: { id: jobId } });
      
      if (!job || job.status !== JobStatus.OPEN) {
        throw new Error("Job is no longer available.");
      }
      
      if (job.seekerId === workerId) {
        throw new Error("You cannot accept a job you posted.");
      }

      return await tx.job.update({
        where: { id: jobId },
        data: { 
          status: JobStatus.ACCEPTED,
          workerId,
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
      data: { status: JobStatus.COMPLETED },
      include: { worker: true }
    });
    
    console.log(`Processing payment of $${job.price} to worker: ${job.worker?.name}`);

    res.json({ message: "Job completed and paid successfully.", job });
  } catch (error) {
    res.status(500).json({ error: "Failed to complete job" });
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`🚀 Oddjob API running on http://localhost:${PORT}`);
});
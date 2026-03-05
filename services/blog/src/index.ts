import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import postsRouter from './routes/posts';
import queueRouter from './routes/queue';
import generateRouter from './routes/generate';
import prioritiseRouter from './routes/prioritise';
import suggestRouter from './routes/suggest';
import feedRouter from './routes/feed';
import { startScheduler } from './scheduler';

const app = express();
const PORT = process.env.PORT ?? 3002;

const ALLOWED_ORIGINS = [
  'https://dashboard.arclink.dev',
  'http://localhost:4200',
  'http://localhost:3000',
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-api-key');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

app.use(express.json({ limit: '5mb' }));

app.use('/posts/:tenantId/feed.xml', feedRouter);
app.use('/posts/:tenantId', postsRouter);
app.use('/queue/:tenantId', queueRouter);
app.use('/generate/:tenantId', generateRouter);
app.use('/prioritise/:tenantId', prioritiseRouter);
app.use('/suggest/:tenantId', suggestRouter);

async function start(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  startScheduler();

  app.listen(PORT, () => {
    console.log(`Blog service listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});

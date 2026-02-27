import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import postsRouter from './routes/posts';
import queueRouter from './routes/queue';
import generateRouter from './routes/generate';
import prioritiseRouter from './routes/prioritise';
import feedRouter from './routes/feed';
import { startScheduler } from './scheduler';

const app = express();
const PORT = process.env.PORT ?? 3002;

app.use(express.json());

app.use('/posts/:tenantId/feed.xml', feedRouter);
app.use('/posts/:tenantId', postsRouter);
app.use('/queue/:tenantId', queueRouter);
app.use('/generate/:tenantId', generateRouter);
app.use('/prioritise/:tenantId', prioritiseRouter);

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

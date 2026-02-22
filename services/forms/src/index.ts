import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import submitRouter from './routes/submit';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(express.json());

// Handle preflight OPTIONS requests
app.options('/submit/:tenantId', (req, res) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  res.sendStatus(204);
});

app.use('/submit', submitRouter);

async function start(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  app.listen(PORT, () => {
    console.log(`Forms service listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});

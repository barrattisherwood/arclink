import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import loginRouter from './routes/login';
import registerRouter from './routes/register';
import meRouter from './routes/me';

const app = express();
const PORT = process.env.PORT ?? 3004;

const ALLOWED_ORIGINS = [
  'https://admin.arclink.dev',
  'https://dashboard.arclink.dev',
  'https://machinum.io',
  'https://www.machinum.io',
  'http://localhost:4200',
  'http://localhost:3000',
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json());

app.use('/api/auth', loginRouter);
app.use('/api/auth', registerRouter);
app.use('/api/auth', meRouter);

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'auth' }));

async function start(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  app.listen(PORT, () => {
    console.log(`Auth service listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});

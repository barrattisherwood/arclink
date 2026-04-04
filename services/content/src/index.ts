import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import sitesRouter from './routes/sites';
import typesRouter from './routes/types';
import entriesRouter from './routes/entries';
import uploadRouter from './routes/upload';

const app = express();
const PORT = process.env.PORT ?? 3003;

const ALLOWED_ORIGINS = [
  'https://admin.arclink.dev',
  'https://dashboard.arclink.dev',
  'https://machinum.io',
  'https://www.machinum.io',
  'https://dlctownplanning.co.za',
  'https://www.dlctownplanning.co.za',
  'http://localhost:4200',
  'http://localhost:4201',
  'http://localhost:3000',
];

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/\.vercel\.app$/.test(origin)) return true;
  return false;
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-api-key');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json({ limit: '5mb' }));

app.use('/sites', sitesRouter);
app.use('/api/sites', sitesRouter);
app.use('/types/:siteId', typesRouter);
app.use('/api/types/:siteId', typesRouter);
app.use('/entries/:siteId', entriesRouter);
app.use('/api/entries/:siteId', entriesRouter);
app.use('/upload/:siteId', uploadRouter);
app.use('/api/upload/:siteId', uploadRouter);

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'content' }));

async function start(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  app.listen(PORT, () => {
    console.log(`Content service listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});

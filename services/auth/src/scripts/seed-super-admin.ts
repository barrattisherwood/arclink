import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User';

async function seed(): Promise<void> {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('Connected to MongoDB');

  const email = 'barratt@machinum.io';
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!password) {
    console.error('Set ADMIN_SEED_PASSWORD in .env before running');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await User.findOneAndUpdate(
    { email },
    { email, passwordHash, role: 'super-admin', siteId: '*' },
    { upsert: true, new: true }
  );

  console.log(`Super-admin seeded: ${email}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

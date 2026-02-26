import 'dotenv/config';
import mongoose from 'mongoose';
import { Tenant } from '../models/Tenant';

const CONFIRMATIONS: Array<{ name: string; subject: string }> = [
  {
    name: 'findtherapy.care — Site Contact',
    subject: 'Thanks for contacting findtherapy.care',
  },
  {
    name: 'findtherapy.care — Provider Contact',
    subject: 'Thanks for reaching out',
  },
];

async function enable(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(mongoUri);

  for (const { name, subject } of CONFIRMATIONS) {
    const result = await Tenant.updateOne(
      { name },
      { $set: { confirmation_enabled: true, confirmation_subject: subject } },
    );
    if (result.matchedCount === 0) {
      console.warn(`Tenant not found: ${name}`);
    } else {
      console.log(`Enabled confirmation for "${name}" → subject: "${subject}"`);
    }
  }

  await mongoose.disconnect();
}

enable().catch((err) => {
  console.error(err);
  process.exit(1);
});

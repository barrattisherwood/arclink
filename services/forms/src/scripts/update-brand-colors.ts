import 'dotenv/config';
import mongoose from 'mongoose';
import { Tenant } from '../models/Tenant';

const BRAND_COLORS: Record<string, string> = {
  'Machinum Agency Site': '#5a9aaa',
  'findtherapy.care — Site Contact': '#4b5443',
  'findtherapy.care — Provider Contact': '#4b5443',
};

async function update(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(mongoUri);

  for (const [name, color] of Object.entries(BRAND_COLORS)) {
    const result = await Tenant.updateOne({ name }, { $set: { brand_color: color } });
    if (result.matchedCount === 0) {
      console.warn(`Tenant not found: ${name}`);
    } else {
      console.log(`Updated ${name} → brand_color: ${color}`);
    }
  }

  await mongoose.disconnect();
}

update().catch((err) => {
  console.error(err);
  process.exit(1);
});

import 'dotenv/config';
import mongoose from 'mongoose';
import { Tenant } from '../models/Tenant';

async function run(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(mongoUri);

  const result = await Tenant.findOneAndUpdate(
    { id: 'dlc-townplanning' },
    { $set: { cc_emails: ['admin@dlcgroup.co.za'] } },
    { new: true },
  );

  if (!result) {
    console.error('Tenant not found');
    process.exit(1);
  }

  console.log(`Updated cc_emails to: ${result.cc_emails}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

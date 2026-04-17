import 'dotenv/config';
import mongoose from 'mongoose';
import { BlogTenant } from '../models/BlogTenant';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const tenants = await BlogTenant.find({}, { id: 1, name: 1, siteId: 1 });
  tenants.forEach(t => console.log(`${t.name} | siteId: ${t.siteId} | id: ${t.id}`));
  process.exit(0);
}
run().catch(err => { console.error(err); process.exit(1); });

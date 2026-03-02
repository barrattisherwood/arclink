import 'dotenv/config';
import mongoose from 'mongoose';
import { BlogTenant } from '../models/BlogTenant';

async function update(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(mongoUri);

  const result = await BlogTenant.updateOne(
    { name: 'Machinum Agency Site' },
    {
      $set: {
        blog_subject: 'Creative technology, experimental web development, and pushing boundaries with modern web capabilities',
        blog_audience: 'Innovative product builders, creative technologists, and teams exploring the intersection of design and engineering',
        blog_tone: 'Curious and experimental but grounded in production reality - exploring what\'s possible while staying brutally honest about tradeoffs',
      },
    }
  );

  if (result.modifiedCount === 0) {
    console.log('No tenant found or nothing changed.');
  } else {
    console.log('Machinum blog tenant updated.');
  }

  await mongoose.disconnect();
}

update().catch((err) => {
  console.error(err);
  process.exit(1);
});

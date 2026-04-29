import 'dotenv/config';
import mongoose from 'mongoose';
import { Post } from '../models/Post';

function stripLastSentence(text: string): string {
  const trimmed = text.trimEnd();
  // Remove trailing punctuation, then find everything up to the previous sentence boundary
  const withoutLast = trimmed.replace(/[.!?]\s*$/, '');
  const match = withoutLast.match(/^[\s\S]*[.!?]/);
  return match ? match[0].trim() : trimmed;
}

async function run(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

  await mongoose.connect(uri);
  console.log('Connected.\n');

  const posts = await Post.find({
    generated: true,
    article_format: { $in: ['dialogue', 'weekly-roundup'] },
  });

  console.log(`Processing ${posts.length} post(s)...\n`);

  for (const post of posts) {
    for (let i = 0; i < post.dialogue_blocks.length; i++) {
      post.dialogue_blocks[i].content = stripLastSentence(post.dialogue_blocks[i].content);
    }
    for (let i = 0; i < post.fixture_dialogues.length; i++) {
      for (let j = 0; j < post.fixture_dialogues[i].blocks.length; j++) {
        post.fixture_dialogues[i].blocks[j].content = stripLastSentence(post.fixture_dialogues[i].blocks[j].content);
      }
    }

    post.markModified('dialogue_blocks');
    post.markModified('fixture_dialogues');
    await post.save();
    console.log(`  [${post.status}] ${post.title}`);
  }

  console.log('\nDone.');
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });

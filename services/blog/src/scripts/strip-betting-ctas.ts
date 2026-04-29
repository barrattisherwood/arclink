import 'dotenv/config';
import mongoose from 'mongoose';
import { Post } from '../models/Post';

// Matches a full sentence containing a direct "Bet at [Bookmaker]" instruction.
// Handles mid-paragraph and end-of-paragraph placement.
const CTA_RE = /[^.!?\n]*Bet at (?:Hollywoodbets|Betway|10bet)[^.!?\n]*[.!?]?/gi;

function strip(text: string): string {
  return text
    .replace(CTA_RE, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function run(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

  await mongoose.connect(uri);
  console.log('Connected.');

  const posts = await Post.find({
    generated: true,
    content: { $regex: 'Bet at (?:Hollywoodbets|Betway|10bet)', $options: 'i' },
  });

  console.log(`Found ${posts.length} post(s) with CTA language.\n`);

  let updated = 0;
  for (const post of posts) {
    post.content = strip(post.content);

    for (let i = 0; i < post.dialogue_blocks.length; i++) {
      post.dialogue_blocks[i].content = strip(post.dialogue_blocks[i].content);
    }

    for (let i = 0; i < post.fixture_dialogues.length; i++) {
      for (let j = 0; j < post.fixture_dialogues[i].blocks.length; j++) {
        post.fixture_dialogues[i].blocks[j].content = strip(post.fixture_dialogues[i].blocks[j].content);
      }
    }

    post.markModified('dialogue_blocks');
    post.markModified('fixture_dialogues');
    await post.save();

    console.log(`  [${post.status}] ${post.title}`);
    updated++;
  }

  console.log(`\nDone — stripped CTAs from ${updated} post(s).`);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });

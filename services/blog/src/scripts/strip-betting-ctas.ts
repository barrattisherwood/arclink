import 'dotenv/config';
import mongoose from 'mongoose';
import Anthropic from '@anthropic-ai/sdk';
import { Post } from '../models/Post';

const client = new Anthropic();

const SYSTEM = `You are a content editor. Remove any content that is a direct betting recommendation or call to action. This includes:
- "Bet at [Bookmaker]..." sentences
- "Primary bet:", "My bet:", "Back [team]..." directives
- Bookmaker URL references (e.g. safootballbets.co.za/hollywoodbets)
- "data-free on all SA networks" lines
- "Check the [odds board/markets] at [Bookmaker]" sentences
- Orphaned sentence fragments that are clearly the tail of a stripped CTA (e.g. starts mid-word, or is just a URL fragment)
- Any sentence whose primary purpose is directing the reader to place a bet

Keep all sports analysis, market commentary, and factual observations about odds.
Return ONLY the cleaned text. No explanation, no preamble.`;

async function cleanBlock(text: string): Promise<string> {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: SYSTEM,
    messages: [{ role: 'user', content: text }],
  });
  return msg.content[0].type === 'text' ? msg.content[0].text.trim() : text;
}

function rebuildContent(post: typeof Post.prototype): string {
  if (post.article_format === 'weekly-roundup' && post.fixture_dialogues?.length) {
    return post.fixture_dialogues
      .map((fd: any) => {
        const blocks = fd.blocks
          .map((b: any) => `[${b.persona.toUpperCase()}]\n${b.content}\n[/${b.persona.toUpperCase()}]`)
          .join('\n\n');
        return `[FIXTURE: ${fd.matchLabel}]\n${blocks}\n[/FIXTURE]`;
      })
      .join('\n\n');
  }
  return post.dialogue_blocks
    .map((b: any) => `[${b.persona.toUpperCase()}]\n${b.content}\n[/${b.persona.toUpperCase()}]`)
    .join('\n\n');
}

async function run(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

  await mongoose.connect(uri);
  console.log('Connected.\n');

  const posts = await Post.find({
    content: { $regex: 'Bet at |data-free on all SA', $options: 'i' },
  });

  console.log(`Processing ${posts.length} post(s)...\n`);

  for (const post of posts) {
    for (let i = 0; i < post.dialogue_blocks.length; i++) {
      post.dialogue_blocks[i].content = await cleanBlock(post.dialogue_blocks[i].content);
    }
    for (let i = 0; i < post.fixture_dialogues.length; i++) {
      for (let j = 0; j < post.fixture_dialogues[i].blocks.length; j++) {
        post.fixture_dialogues[i].blocks[j].content = await cleanBlock(post.fixture_dialogues[i].blocks[j].content);
      }
    }

    const rebuilt = rebuildContent(post);
    if (rebuilt) post.content = rebuilt;
    post.markModified('dialogue_blocks');
    post.markModified('fixture_dialogues');
    await post.save();
    console.log(`  [${post.status}] ${post.title}`);
  }

  console.log('\nDone.');
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });

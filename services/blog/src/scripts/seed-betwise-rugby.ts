import 'dotenv/config';
import mongoose from 'mongoose';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { BlogTenant } from '../models/BlogTenant';

// ─── PERSONA SYSTEM PROMPTS ───────────────────────────────────────────────────

const KWAGGA_PROMPT = `You are Kwagga van der Berg, SA rugby correspondent for SA Rugby Bets (sarugbybets.co.za). You grew up in Pretoria, a Blue Bulls family. You have watched Currie Cup rugby since before Super Rugby existed. You write about SA provincial rugby — the URC, Currie Cup, Springbok tests — with the authority of someone who actually watches the game rather than the highlights. You are Afrikaans in your cultural frame of reference, though you write in English. You occasionally use an Afrikaans phrase when it fits naturally, never when it feels performed.

VOICE:
Dry, measured, direct. The cadence of someone who thinks before they speak. Not a cheerleader, not a pessimist — an analyst with strong opinions. Your sentences are deliberate. You build a case methodically before delivering a verdict. You never oversell a selection. You present your view as the obvious reading of the evidence.

WHAT YOU LOVE:
A dominant scrum used as a match-winning weapon. Teams that read the conditions and play accordingly. Proper Currie Cup rugby — physical, territorial, honest. Flyhalves who can kick under pressure. The Springboks when they play with structure. Lineouts that work in the wet.

WHAT YOU HATE:
Backline-first rugby that ignores the conditions. Bok selection that defies logic. Overseas coaches who haven't learned what the Currie Cup demands. Short-priced favourites on reputation alone. Pundits who only watch Springboks tests.

ANALYTICAL LENS:
Set piece first, always. Every preview must address the scrum and lineout matchup before anything else — this is where games are won and lost. Second: conditions and territory. Third: Springbok call-up impact on provincial squads — your value edge that European odds compilers miss.

VOCABULARY:
Rugby-specific throughout. Breakdown, gainline, box kick, carry, lineout maul, jackal, tighthead, loosehead, loosie, flyhalf, inside centre. Never use football language.

BOOKMAKER INTEGRATION:
Always reference specific bookmakers and their odds. Connect set piece and conditions analysis to whether the price represents value. Use "Bet at [Bookmaker]" framing — never comparative price claims.

HARD RULES:
Never express surprise at outcomes. Never use exclamation marks. Never use football vocabulary. Always address the set piece. Never fabricate confirmed injury news or squad selections — frame as "reportedly" or "from what I understand."

STRUCTURE:
Open with the set piece matchup or conditions angle others are ignoring. Build through provincial context and squad depth. Arrive at the bookmaker recommendation. Close with quiet, confident certainty. Approximately 450 words for previews.`;

const MARCUS_PROMPT = `You are Marcus Webb, rugby tactics and markets correspondent for SA Rugby Bets (sarugbybets.co.za). You are Welsh-born, played club rugby in Wales, and came to South Africa in 2009 to help coach a junior provincial academy. You found SA rugby unlike anything in Europe and never went home. You have spent fifteen years watching SA rugby from inside the system — from pitches and academies, not press boxes. You write through the dual lens of a former player who understands the game structurally, and someone who has spent years watching the betting market price it incorrectly.

VOICE:
Precise, analytical, occasionally sardonic about the market. You find it genuinely interesting when odds are wrong — not frustrating, interesting. You approach rugby betting like an engineer approaches a problem: inputs, outputs, and somewhere between them is inefficiency. Sharp, specific sentences. You name tactics, systems, tendencies. Never vague when a specific term exists.

WHAT YOU LOVE:
Defensive blitz systems executed with discipline. Teams that control the gainline with consistent carries. When structural pattern analysis predicts an upset before kickoff. Odds that have clearly priced the wrong matchup. The first five minutes — you watch how teams set their defensive shape.

WHAT YOU HATE:
Market odds driven by reputation rather than current structural form. Commentary that ignores defensive architecture. Narrative-driven betting — backing a team "on a run" without understanding why. Scorelines that flatter a team's actual performance.

ANALYTICAL LENS:
Defensive system and gainline control first — a team that cannot stop carries over the gainline will lose regardless of backline quality. Second: breakdown tendencies and penalty rate — third-quarter fatigue is structural, not disciplinary. Third: structural vs narrative pricing — the market prices recent scorelines, not the structural reasons behind them.

EUROPEAN REFERENCE FRAME:
Use Six Nations and Premiership Rugby comparisons as reference points for tactical concepts — not to suggest European rugby is superior. You came to SA because you found it more honest in many ways. Always bring European references back to the SA context.

LINE MOVEMENT:
Track odds shifts. Always have an opinion on whether movement reflects information or just money following narrative. When odds shorten on a team whose structural case hasn't changed, note it.

BOOKMAKER INTEGRATION:
Always reference specific bookmakers and their odds. Connect tactical and structural analysis to the betting decision. Use "Bet at [Bookmaker]" framing — never comparative price claims. Anchor recommendations to structural reasons.

HARD RULES:
Always identify the specific structural matchup — not "they have better players" but which breakdown system, which defensive shape. Never be dismissive of SA rugby. Never back narrative over structure. Never fabricate statistics — frame patterns as "from what I've seen" or "the pattern suggests."

STRUCTURE:
Open with the structural matchup the market appears to have missed. Build through tactical and breakdown analysis. Address line movement if relevant. Arrive at the bookmaker recommendation with structural justification. Close with a precise statement of position. Approximately 450 words.`;

// ─── SEED FUNCTION ────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(mongoUri);

  const existing = await BlogTenant.findOne({ name: 'BetWise Rugby' });
  if (existing) {
    console.log('BetWise Rugby tenant already exists — skipping.');
    console.log('Tenant ID:', existing.id);
    await mongoose.disconnect();
    return;
  }

  const plaintextKey = randomBytes(32).toString('hex');
  const hashedKey = createHash('sha256').update(plaintextKey).digest('hex');

  const tenant = await BlogTenant.create({
    id: randomUUID(),
    api_key: hashedKey,
    name: 'BetWise Rugby',
    allowed_origin: 'https://www.sarugbybets.co.za',
    active: true,

    blog_subject:
      'South African rugby betting — URC odds analysis, Currie Cup fixture previews, ' +
      'Springbok test match previews, bookmaker comparisons, and value bet ' +
      'identification for SA and international rugby markets',

    blog_audience:
      'South African rugby bettors aged 25–50 who follow the Currie Cup, URC, ' +
      'and Springboks. Comfortable with decimal odds. Want informed set-piece ' +
      'and tactical analysis alongside the betting angle, not just score predictions',

    // blog_tone is used as fallback only — persona prompts are primary
    blog_tone:
      'Knowledgeable SA rugby analysis connecting tactical insight to betting decisions. ' +
      'Never fabricates statistics. Always connects insight to specific bookmaker odds.',

    blog_word_count: 450,
    blog_cadence: 2,
    blog_publish_day: 5,   // Friday
    blog_publish_hour: 7,  // 07:00

    blog_predefined_tags: [
      'urc',
      'currie-cup',
      'springboks',
      'super-rugby',
      'fixture-preview',
      'odds-analysis',
      'value-bets',
      'set-piece',
      'kwagga',   // ← persona routing tag for Angular frontend
      'marcus',   // ← persona routing tag for Angular frontend
    ],

    blog_predefined_categories: [
      'Fixture Previews',
      'Odds Analysis',
      'Bookmaker Reviews',
      'Rugby Betting Guide',
    ],

    blog_persona_prompts: new Map([
      ['kwagga', KWAGGA_PROMPT],
      ['marcus', MARCUS_PROMPT],
    ]),

    blog_canonical_base: 'https://www.sarugbybets.co.za',
    created_at: new Date(),
  });

  console.log('');
  console.log('✓ BetWise Rugby tenant created successfully.');
  console.log('─────────────────────────────────────────────────────');
  console.log('Tenant ID:  ', tenant.id);
  console.log('API Key:    ', plaintextKey);
  console.log('─────────────────────────────────────────────────────');
  console.log('⚠  Save the API key now — it cannot be recovered.');
  console.log('');
  console.log('Add these to apps/rugby/src/environments/environment.ts:');
  console.log(`  arclinkBlogTenantId: '${tenant.id}'`);
  console.log(`  arclinkBlogApiKey: 'THE_PLAINTEXT_KEY_ABOVE'`);
  console.log('');
  console.log('Add the same values to Vercel environment variables.');
  console.log('');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

import 'dotenv/config';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { TitleQueue } from '../models/TitleQueue';
import { BlogTenant } from '../models/BlogTenant';

const NOW = new Date();
const THIRTY_MINS = new Date(NOW.getTime() + 30 * 60 * 1000);

// P2 articles: generate June 9, publish June 10 08:00 SAST (06:00 UTC)
const GENERATE_JUNE_9  = new Date('2026-06-09T04:00:00Z');
const PUBLISH_JUNE_10  = new Date('2026-06-10T06:00:00Z');

const ARTICLES = [
  // ── P1: generate + publish immediately ────────────────────────────────────
  {
    title: "World Cup 2026 Tournament Winner Betting Guide — Lucky and Callum's Picks",
    persona_tag: 'lucky',
    force_single_persona: false,
    generate_at: NOW,
    publish_at: THIRTY_MINS,
    tags: ['world-cup-2026', 'odds-analysis', 'fixture-preview'],
    additional_context: `FIFA World Cup 2026. June 11 – July 19. 48 teams, USA/Canada/Mexico.
Lucky opens with the SA bettor's perspective — which nations SA fans back and why. Argentina as defending champions. Brazil's Vinicius-led squad. Morocco as Africa's best hope and why SA bettors should care. Lucky references the Hollywoodbets tournament winner market.
Callum responds with the market angle — where the odds are compressed (France, England) versus where the value sits. Identifies one non-obvious selection the market is underpricing. Tactical reasoning for why a specific team suits the tournament format.
Neither analyst picks the same winner. Both reference specific Hollywoodbets markets analytically — discuss whether the price represents value, not a direct instruction to bet.`,
  },
  {
    title: 'World Cup 2026 Group Stage Betting Guide — Where the Value Sits',
    persona_tag: 'lucky',
    force_single_persona: false,
    generate_at: NOW,
    publish_at: THIRTY_MINS,
    tags: ['world-cup-2026', 'odds-analysis'],
    additional_context: `FIFA World Cup 2026 group stage preview. Cover three specific group stage matchups that offer betting value:
1. Argentina vs Chile (Group B) — continental derby, SA bettors love this fixture. Lucky covers the SA bettor angle; Callum covers tactical matchup and market pricing.
2. England vs Serbia (Group D) — Callum's natural territory. Lucky gives the SA perspective; Callum gives tactical breakdown.
3. Morocco vs Croatia (Group J) — African interest, tactical intrigue. Lucky leads on African angle; Callum on market pricing.
For each fixture, discuss the Hollywoodbets market analytically — is the price right? Neither analyst should issue a direct betting instruction.`,
  },
  {
    title: 'Brazil at World Cup 2026 — Vinicius Jr, the Golden Boot, and Whether the Seleção Can Finally Win It',
    persona_tag: 'callum',
    force_single_persona: true,
    generate_at: NOW,
    publish_at: THIRTY_MINS,
    tags: ['world-cup-2026', 'odds-analysis', 'brazil'],
    additional_context: `Callum analyses Brazil's tournament chances through a tactical and market lens. Cover: Dorival Júnior's system, Vinicius Jr as both tournament winner and Golden Boot candidate, Brazil's draw and likely knockout path, and why the market may be underpricing or overpricing them relative to European competition.
Reference the Hollywoodbets markets for tournament winner, Golden Boot (Vinicius Jr), and Brazil to reach semi-final — discuss whether the prices look right, not as direct instructions.`,
  },
  {
    title: 'Argentina at World Cup 2026 — Can the Defending Champions Do It Again?',
    persona_tag: 'lucky',
    force_single_persona: true,
    generate_at: NOW,
    publish_at: THIRTY_MINS,
    tags: ['world-cup-2026', 'odds-analysis', 'argentina'],
    additional_context: `Lucky covers Argentina from the SA bettor perspective — Messi context, defending champion psychology, squad depth beyond the star. How SA football fans relate to Argentina's style and history.
Group B analysis — Chile, Ivory Coast, Slovakia — path to knockout rounds. Lucky's honest assessment of whether Argentina can repeat.
Reference Hollywoodbets markets: Argentina tournament winner, Argentina to reach final, Messi assists market if available — discuss market value analytically, not as direct instructions.`,
  },
  {
    title: "Africa at World Cup 2026 — Morocco, Nigeria, Senegal and the Continent's Best Chance Yet",
    persona_tag: 'lucky',
    force_single_persona: false,
    generate_at: NOW,
    publish_at: THIRTY_MINS,
    tags: ['world-cup-2026', 'odds-analysis', 'afcon'],
    additional_context: `Highest SA-relevance angle outside the major European nations. Lucky leads — African football identity, SA's connection to the continent's teams, Morocco's 2022 semi-final legacy and whether they can match it, Nigeria and Senegal as dark horses.
Callum responds with tactical and market analysis — how African sides match up against European opposition tactically, where the market systematically undervalues African teams in group stage matchups.
Discuss the Hollywoodbets market on Morocco to reach knockout rounds — is the price right? Analytical commentary, not a direct instruction.`,
  },

  // ── P2: generate June 9, publish June 10 ──────────────────────────────────
  {
    title: 'World Cup 2026 Golden Boot Betting Guide — Callum Runs the Numbers',
    persona_tag: 'callum',
    force_single_persona: true,
    generate_at: GENERATE_JUNE_9,
    publish_at: PUBLISH_JUNE_10,
    tags: ['world-cup-2026', 'odds-analysis'],
    additional_context: `Pure market analysis from Callum. Cover the top Golden Boot candidates: Vinicius Jr, Mbappé, Harry Kane, Lautaro Martínez, Erling Haaland.
For each: tournament path (how many matches they're likely to play), team's scoring distribution (does the team rely on this player for goals), historical Golden Boot pattern — tournament top scorers tend to come from teams that go deep, always reference this structural point.
Identify one value pick the market underrates. Discuss the Hollywoodbets Golden Boot market analytically — commentary on whether prices represent value, not direct instructions.`,
  },
  {
    title: "England at World Cup 2026 — Callum's Honest Assessment of Whether It's Finally Coming Home",
    persona_tag: 'callum',
    force_single_persona: true,
    generate_at: GENERATE_JUNE_9,
    publish_at: PUBLISH_JUNE_10,
    tags: ['world-cup-2026', 'odds-analysis', 'england'],
    additional_context: `Callum is Scottish — use this tension. He respects the squad quality, is sceptical of the tournament mentality, and has specific tactical concerns. Cover: Gareth Southgate's legacy vs new manager's approach, squad depth, Group D path (England vs Serbia), knockout draw.
This piece should have genuine editorial voice — Callum's dry Scottish scepticism applied to England's perennial tournament hope.
Discuss Hollywoodbets markets: England tournament winner, England to reach semi-final, first match result vs Serbia — analytical commentary on market pricing, not direct instructions.`,
  },
];

async function run(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

  await mongoose.connect(uri);
  console.log('Connected.\n');

  const tenant = await BlogTenant.findOne({ name: 'SA Football Bets' });
  if (!tenant) { console.error('SA Football Bets tenant not found'); process.exit(1); }

  const last = await TitleQueue.findOne({ tenant_id: tenant.id }).sort({ priority: -1 });
  let priority = last ? last.priority + 1 : 0;

  for (const article of ARTICLES) {
    await TitleQueue.create({
      id: randomUUID(),
      tenant_id: tenant.id,
      title: article.title,
      notes: null,
      additional_context: article.additional_context,
      persona_tag: article.persona_tag,
      force_single_persona: article.force_single_persona,
      fixtures: [],
      generate_at: article.generate_at,
      publish_at: article.publish_at,
      schedule_status: 'pending',
      content_type: 'tournament-window',
      priority: priority++,
      created_at: new Date(),
    });
    const label = article.generate_at <= NOW ? 'P1 (now)' : 'P2 (June 10)';
    console.log(`  Queued [${label}]: ${article.title}`);
  }

  console.log(`\nQueued ${ARTICLES.length} World Cup articles for SA Football Bets.`);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });

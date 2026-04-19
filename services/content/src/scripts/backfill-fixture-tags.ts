import 'dotenv/config';
import mongoose from 'mongoose';
import { ContentEntry } from '../models/ContentEntry';

const COMPETITION_TAG_MAP: Record<string, string> = {
  // Football
  'PSL': 'psl', 'Nedbank Cup': 'psl', 'Carling Knockout': 'psl', 'MTN 8': 'psl',
  'Premier League': 'epl',
  'Champions League': 'ucl', 'Europa League': 'ucl',
  'CAF Champions League': 'caf',
  'AFCON': 'afcon',
  'COSAFA Cup': 'bafana',
  // Rugby — both canonical names and SportDB short names
  'United Rugby Championship': 'urc', 'URC': 'urc',
  'Currie Cup': 'currie-cup',
  'Rugby Championship': 'rugby-championship',
  'Super Rugby': 'super-rugby', 'Super Rugby Pacific': 'super-rugby',
  'Premiership Rugby': 'premiership-rugby',
  // Cricket — canonical names + SportDB tour/series names
  'ODI Series': 'odi', 'T20 International': 't20i', 'Test Series': 'test',
  'SA20': 'sa20', 'IPL': 'ipl', 'CSA T20 Challenge': 'csa-t20',
  // Tennis
  'Australian Open': 'australian-open', 'Australian Open (W)': 'australian-open',
  'French Open': 'french-open',
  'Wimbledon': 'wimbledon', 'Wimbledon (W)': 'wimbledon',
  'US Open': 'us-open', 'US Open (W)': 'us-open',
};

const ATP_NAMES = [
  'Indian Wells', 'Miami Open', 'Monte Carlo', 'Madrid Open', 'Rome',
  'Cincinnati', 'Paris Masters', 'ATP Finals', 'Rotterdam', 'Dubai',
  'Rio de Janeiro', 'Barcelona', 'Munich', 'Halle', "Queen's Club",
  'Hamburg', 'Washington', 'Beijing', 'Tokyo', 'Vienna', 'Basel',
];
for (const name of ATP_NAMES) COMPETITION_TAG_MAP[name] = 'atp';

async function run() {
  await mongoose.connect(process.env['MONGODB_URI']!);
  console.log('Connected. Backfilling fixture tags...\n');

  const entries = await ContentEntry.find({ contentTypeSlug: 'fixture', 'data.tag': { $exists: false } });
  console.log(`Found ${entries.length} fixtures without a tag`);

  let updated = 0;
  let skipped = 0;

  for (const entry of entries) {
    const competition = entry.data?.competition as string;
    let tag = COMPETITION_TAG_MAP[competition];

    // Fallback: prefix matching for tour/series names SportDB returns
    if (!tag) {
      if (/ODI/i.test(competition))  tag = 'odi';
      else if (/T20/i.test(competition)) tag = 't20i';
      else if (/Test/i.test(competition)) tag = 'test';
      else if (/SA20/i.test(competition)) tag = 'sa20';
      else if (/IPL/i.test(competition)) tag = 'ipl';
    }

    if (!tag) {
      console.warn(`  No tag mapping for competition: "${competition}" (${entry.siteId})`);
      skipped++;
      continue;
    }

    entry.data = { ...entry.data, tag };
    entry.markModified('data');
    await entry.save();
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });

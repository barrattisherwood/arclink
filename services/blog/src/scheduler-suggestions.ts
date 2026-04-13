import cron from 'node-cron';
import { randomUUID } from 'crypto';
import { BlogTenant } from './models/BlogTenant';
import { ContentSuggestion } from './models/ContentSuggestion';
import { TitleQueue } from './models/TitleQueue';
import { fetchUpcomingFixtures } from './services/sportdb';
import { suggestContentForFixtures } from './services/content-suggester';

/**
 * Runs the suggestion scan for a single tenant.
 * Exported so it can also be triggered manually via the suggestions route.
 */
export async function runSuggestionsForTenant(tenantId: string): Promise<number> {
  const tenant = await BlogTenant.findOne({ id: tenantId, active: true });
  if (!tenant || !tenant.sport_key) return 0;

  const fixtures = await fetchUpcomingFixtures(tenant.sport_key, 14);
  if (!fixtures.length) return 0;

  const suggestions = suggestContentForFixtures(tenant, fixtures);

  // Fixture labels already in the queue (pending or generating)
  const queuedLabels = await TitleQueue.distinct('fixture_label', {
    tenant_id: tenantId,
    fixture_label: { $ne: null },
  }) as string[];

  // Fixture labels already suggested and not dismissed (avoid re-suggesting dismissed ones)
  const existingLabels = await ContentSuggestion.distinct('fixture_label', {
    tenant_id: tenantId,
    fixture_label: { $ne: null },
    status: { $in: ['pending', 'approved'] },
  }) as string[];

  const seen = new Set([...queuedLabels, ...existingLabels]);

  const newSuggestions = suggestions.filter(
    s => s.fixture_label && !seen.has(s.fixture_label)
  );

  if (!newSuggestions.length) return 0;

  await ContentSuggestion.insertMany(
    newSuggestions.map(s => ({
      id:           randomUUID(),
      tenant_id:    tenantId,
      title:        s.title,
      content_type: s.content_type,
      persona_tag:  s.persona_tag,
      fixture_date: s.fixture_date,
      fixture_label: s.fixture_label,
      competition:  s.competition,
      generate_at:  s.generate_at,
      publish_at:   s.publish_at,
      reason:       s.reason,
      status:       'pending',
      created_at:   new Date(),
    }))
  );

  return newSuggestions.length;
}

// Wednesday 04:00 UTC (= 06:00 SAST) — after Tuesday's weekly roundup
cron.schedule('0 4 * * 3', async () => {
  console.log('[Suggestion Scheduler] Starting fixture scan...');

  const tenants = await BlogTenant.find({ active: true, sport_key: { $ne: '' } });

  for (const tenant of tenants) {
    try {
      const count = await runSuggestionsForTenant(tenant.id);
      console.log(`[Suggestion Scheduler] ${count} new suggestion(s) for ${tenant.name}`);
    } catch (err) {
      console.error(`[Suggestion Scheduler] Failed for ${tenant.name}:`, err);
    }
  }
});

console.log('Suggestion scheduler started');

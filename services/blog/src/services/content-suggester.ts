import { IBlogTenant } from '../models/BlogTenant';
import { SportDbFixture } from './sportdb';

export interface ContentSuggestion {
  title:         string;
  content_type:  'match-preview';
  persona_tag:   string | null;
  fixture_date:  string;   // ISO string of kickoff
  fixture_label: string;
  competition:   string;
  generate_at:   Date;
  publish_at:    Date;
  reason:        string;
}

/**
 * Generates content suggestions for a set of upcoming fixtures.
 * One match-preview suggestion per fixture, with personas rotated across the batch.
 */
export function suggestContentForFixtures(
  tenant: IBlogTenant,
  fixtures: SportDbFixture[]
): ContentSuggestion[] {
  const personas = tenant.blog_persona_prompts
    ? [...tenant.blog_persona_prompts.keys()]
    : [];

  return fixtures.map((fixture, i) => {
    const kickoff   = new Date(fixture.kickoff);
    const persona   = personas.length > 0 ? personas[i % personas.length] : null;

    // Generate 48 hours before kickoff
    const generate_at = new Date(kickoff.getTime() - 48 * 3600_000);

    // Publish at 06:00 UTC on match day (= 08:00 SAST)
    const publish_at = new Date(kickoff);
    publish_at.setUTCHours(6, 0, 0, 0);
    // If that's already past (e.g. early morning match), keep it
    if (publish_at > kickoff) {
      publish_at.setUTCDate(publish_at.getUTCDate() - 1);
    }

    const title = `${fixture.homeTeam} vs ${fixture.awayTeam}: Match Preview`;

    return {
      title,
      content_type:  'match-preview',
      persona_tag:   persona,
      fixture_date:  fixture.kickoff,
      fixture_label: fixture.matchLabel,
      competition:   fixture.competition,
      generate_at,
      publish_at,
      reason: `Upcoming ${fixture.competition} fixture: ${fixture.matchLabel}`,
    };
  });
}

import { ContentEntry } from '../models/ContentEntry';
import { SportDbFixture } from './sportdb';

export async function fetchUpcomingFixturesFromDb(
  siteId: string,
  daysAhead: number
): Promise<SportDbFixture[]> {
  const now = new Date();
  const cutoff = new Date(Date.now() + daysAhead * 86400000);

  const entries = await ContentEntry.find({
    siteId,
    contentTypeSlug: 'fixture',
    'data.kickoff': { $gt: now.toISOString(), $lte: cutoff.toISOString() },
  }).sort({ 'data.kickoff': 1 });

  return entries.map(entry => {
    const { homeTeam, awayTeam, kickoff, competition, tag } = entry.data;
    const kickoffDate = new Date(kickoff);
    const day = kickoffDate.toLocaleDateString('en-ZA', {
      weekday: 'short', timeZone: 'Africa/Johannesburg',
    });
    const time = kickoffDate.toLocaleTimeString('en-ZA', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg',
    });

    return {
      id: entry.slug,
      homeTeam,
      awayTeam,
      competition,
      competitionTag: tag,
      venue: 'TBC',
      kickoff,
      matchLabel: `${homeTeam} vs ${awayTeam} · ${day} ${time}`,
    };
  });
}

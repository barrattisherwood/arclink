import { Resend } from 'resend';
import { CronLog } from '../models/CronLog';
import { ContentEntry } from '../models/ContentEntry';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM    = 'system@arclink.dev';
const TO      = process.env.REPORT_TO_EMAIL ?? 'barratt@machinum.io';
const WINDOW  = 2 * 60 * 60 * 1000; // 2 hours — covers the day's batch

const SPORT_LABELS: Record<string, string> = {
  'fixture-sync-rugby':    'Rugby Union',
  'fixture-sync-cricket':  'Cricket',
  'fixture-sync-football': 'Football',
  'fixture-sync-tennis':   'Tennis',
};

// Suffix variants logged by the manual endpoint
const SPORT_SUFFIXES = ['', '-manual'];

interface SportReport {
  label:      string;
  siteId:     string;
  status:     string;
  synced:     number;
  errors:     Array<{ competition: string; message: string }>;
  fixtures:   Array<{ matchLabel: string; kickoff: string }>;
}

async function fetchRecentLogs(): Promise<SportReport[]> {
  const since = new Date(Date.now() - WINDOW);

  // Only the four scheduled jobs (not manual)
  const jobPrefixes = Object.keys(SPORT_LABELS);

  const logs = await CronLog.find({
    job:       { $in: jobPrefixes },
    startedAt: { $gte: since },
  }).sort({ startedAt: -1 });

  // Deduplicate — keep only the most recent run per job prefix
  const seen = new Set<string>();
  const deduped = logs.filter(l => {
    if (seen.has(l.job)) return false;
    seen.add(l.job);
    return true;
  });

  return Promise.all(deduped.map(async log => {
    const siteId = siteIdForJob(log.job);
    const fixtures = siteId ? await fetchSampleFixtures(siteId) : [];
    return {
      label:   SPORT_LABELS[log.job] ?? log.job,
      siteId:  siteId ?? '—',
      status:  log.status,
      synced:  log.fixturesSynced ?? 0,
      errors:  log.syncErrors ?? [],
      fixtures,
    };
  }));
}

function siteIdForJob(job: string): string | null {
  if (job.includes('rugby'))    return 'betwise-rugby';
  if (job.includes('cricket'))  return 'betwise-cricket';
  if (job.includes('football')) return 'betwise-football';
  if (job.includes('tennis'))   return 'satennis';
  return null;
}

async function fetchSampleFixtures(siteId: string, limit = 3) {
  const now = new Date();
  const entries = await ContentEntry.find({
    siteId,
    contentTypeSlug: 'fixture',
    published: true,
    'data.kickoff': { $gte: now.toISOString() },
  })
    .sort({ 'data.kickoff': 1 })
    .limit(limit)
    .lean();

  return entries.map(e => {
    const { homeTeam, awayTeam, kickoff, competition } = e.data;
    const kickoffDate = new Date(kickoff);
    const label = kickoffDate.toLocaleDateString('en-ZA', {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Africa/Johannesburg',
    });
    return { matchLabel: `${homeTeam} vs ${awayTeam} (${competition})`, kickoff: label };
  });
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function statusPill(status: string): string {
  const ok      = '#15803d';
  const partial = '#b45309';
  const fail    = '#b91c1c';
  const running = '#1d4ed8';
  const color   = status === 'success' ? ok : status === 'partial' ? partial : status === 'failed' ? fail : running;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:${color};color:#fff;text-transform:uppercase;letter-spacing:0.05em;">${status}</span>`;
}

function buildSportSection(r: SportReport): string {
  const fixtureRows = r.fixtures.length
    ? r.fixtures.map(f => `
        <tr>
          <td style="padding:5px 0;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;">${f.matchLabel}</td>
          <td style="padding:5px 0 5px 16px;font-size:12px;color:#9ca3af;white-space:nowrap;border-bottom:1px solid #f3f4f6;">${f.kickoff} SAST</td>
        </tr>`).join('')
    : `<tr><td colspan="2" style="padding:6px 0;font-size:12px;color:#9ca3af;">No upcoming fixtures in DB</td></tr>`;

  const errorBlock = r.errors.length ? `
    <p style="margin:8px 0 4px;font-size:11px;font-weight:600;color:#b91c1c;text-transform:uppercase;letter-spacing:0.05em;">Errors</p>
    ${r.errors.map(e => `<p style="margin:2px 0;font-size:12px;color:#ef4444;">${e.competition}: ${e.message}</p>`).join('')}
  ` : '';

  return `
  <div style="margin-bottom:28px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
    <div style="background:#f9fafb;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e5e7eb;">
      <span style="font-size:14px;font-weight:600;color:#111827;">${r.label}</span>
      <div style="display:flex;align-items:center;gap:10px;">
        ${statusPill(r.status)}
        <span style="font-size:12px;color:#6b7280;">${r.synced} synced</span>
      </div>
    </div>
    <div style="padding:12px 16px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Upcoming fixtures</p>
      <table width="100%" cellpadding="0" cellspacing="0">${fixtureRows}</table>
      ${errorBlock}
    </div>
  </div>`;
}

function buildHtml(reports: SportReport[], runDate: string): string {
  const allOk      = reports.every(r => r.status === 'success');
  const anyFailed  = reports.some(r => r.status === 'failed');
  const accentColor = anyFailed ? '#b91c1c' : allOk ? '#15803d' : '#b45309';
  const headlineStatus = anyFailed ? 'Issues detected' : allOk ? 'All sports synced' : 'Partial sync';

  const sportSections = reports.map(buildSportSection).join('');
  const noData = reports.length === 0
    ? '<p style="color:#6b7280;font-size:14px;">No cron runs found in the last 2 hours.</p>'
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

        <!-- Accent bar -->
        <tr><td height="4" style="background:${accentColor};font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- Header -->
        <tr><td style="padding:28px 32px 16px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;">Arclink · Fixture Sync</p>
          <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#111827;">${headlineStatus}</h1>
          <p style="margin:0;font-size:13px;color:#6b7280;">${runDate} UTC</p>
        </td></tr>

        <!-- Divider -->
        <tr><td style="padding:0 32px;"><div style="height:1px;background:#e5e7eb;"></div></td></tr>

        <!-- Sport sections -->
        <tr><td style="padding:24px 32px;">
          ${sportSections}
          ${noData}
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:14px 32px;">
          <p style="margin:0;font-size:11px;color:#d1d5db;text-align:center;">
            Arclink content service &mdash; <a href="https://admin.arclink.dev" style="color:#9ca3af;text-decoration:none;">admin.arclink.dev</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function sendFixtureSyncReport(): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[ReportEmail] RESEND_API_KEY not set — skipping report');
    return;
  }

  try {
    const reports = await fetchRecentLogs();
    const runDate = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const anyFailed = reports.some(r => r.status === 'failed');
    const subject = anyFailed
      ? `[Arclink] Fixture sync issues — ${runDate}`
      : `[Arclink] Fixture sync OK — ${runDate}`;

    const { error } = await resend.emails.send({
      from: FROM,
      to:   TO,
      subject,
      html: buildHtml(reports, runDate),
    });

    if (error) {
      console.error('[ReportEmail] Resend error:', error.message);
    } else {
      console.log(`[ReportEmail] Sent to ${TO} — ${reports.length} sport(s) covered`);
    }
  } catch (err: any) {
    console.error('[ReportEmail] Failed to send report:', err?.message ?? err);
  }
}

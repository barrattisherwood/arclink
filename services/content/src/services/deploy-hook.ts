// Triggers a Vercel deploy hook to rebuild a betting site after a fixture sync.
// The sites are static Vercel deploys with no SSR runtime, so a fixture-sync
// update is only visible once the site rebuilds.

const DEPLOY_HOOKS: Record<string, string> = {
  'betwise-rugby':    process.env['VERCEL_DEPLOY_HOOK_RUGBY']    ?? '',
  'betwise-football': process.env['VERCEL_DEPLOY_HOOK_FOOTBALL'] ?? '',
  'betwise-cricket':  process.env['VERCEL_DEPLOY_HOOK_CRICKET']  ?? '',
  satennis:           process.env['VERCEL_DEPLOY_HOOK_TENNIS']   ?? '',
};

// Batches a run of fixture upserts for the same site into a single rebuild.
const DEBOUNCE_MS = 2 * 60 * 1000;
const pending = new Map<string, NodeJS.Timeout>();

async function callHook(siteId: string): Promise<void> {
  const hookUrl = DEPLOY_HOOKS[siteId];
  if (!hookUrl) {
    console.warn(`[DeployHook] No deploy hook configured for site: ${siteId}`);
    return;
  }

  try {
    const res = await fetch(hookUrl, { method: 'POST' });
    if (!res.ok) {
      console.error(`[DeployHook] Failed for ${siteId}:`, res.status, await res.text());
    } else {
      console.log(`[DeployHook] Triggered rebuild for ${siteId}`);
    }
  } catch (err) {
    console.error(`[DeployHook] Error for ${siteId}:`, err);
  }
}

/** Call after a fixture sync. Debounced per site. */
export function triggerDeploy(siteId: string): void {
  const existing = pending.get(siteId);
  if (existing) clearTimeout(existing);

  pending.set(siteId, setTimeout(() => {
    pending.delete(siteId);
    void callHook(siteId);
  }, DEBOUNCE_MS));
}

/** Fires immediately, no debounce — used by the daily scheduled rebuild. */
export async function triggerDeployNow(siteId: string): Promise<void> {
  await callHook(siteId);
}

export const DEPLOY_HOOK_SITE_IDS = Object.keys(DEPLOY_HOOKS);

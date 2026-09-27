// Triggers a Vercel deploy hook to rebuild a betting site after content changes.
// Replaces revalidateSite()/api/revalidate: the sites are static Vercel deploys
// with no SSR runtime, so there is no on-demand cache to bust — the only way to
// get new content live is a full rebuild.

const DEPLOY_HOOKS: Record<string, string> = {
  rugby_union: process.env['VERCEL_DEPLOY_HOOK_RUGBY']    ?? '',
  football:    process.env['VERCEL_DEPLOY_HOOK_FOOTBALL'] ?? '',
  cricket:     process.env['VERCEL_DEPLOY_HOOK_CRICKET']  ?? '',
  tennis:      process.env['VERCEL_DEPLOY_HOOK_TENNIS']   ?? '',
};

// Batches a burst of publishes for the same sport (e.g. the weekly roundup
// publishing several drafts back to back) into a single rebuild.
const DEBOUNCE_MS = 2 * 60 * 1000;
const pending = new Map<string, NodeJS.Timeout>();

async function callHook(sportKey: string): Promise<void> {
  const hookUrl = DEPLOY_HOOKS[sportKey];
  if (!hookUrl) {
    console.warn(`[DeployHook] No deploy hook configured for sport: ${sportKey}`);
    return;
  }

  try {
    const res = await fetch(hookUrl, { method: 'POST' });
    if (!res.ok) {
      console.error(`[DeployHook] Failed for ${sportKey}:`, res.status, await res.text());
    } else {
      console.log(`[DeployHook] Triggered rebuild for ${sportKey}`);
    }
  } catch (err) {
    console.error(`[DeployHook] Error for ${sportKey}:`, err);
  }
}

/** Call after any publish. Debounced per sport. */
export function triggerDeploy(sportKey: string): void {
  const existing = pending.get(sportKey);
  if (existing) clearTimeout(existing);

  pending.set(sportKey, setTimeout(() => {
    pending.delete(sportKey);
    void callHook(sportKey);
  }, DEBOUNCE_MS));
}

/** Fires immediately, no debounce — used by the daily scheduled rebuild. */
export async function triggerDeployNow(sportKey: string): Promise<void> {
  await callHook(sportKey);
}

export const DEPLOY_HOOK_SPORT_KEYS = Object.keys(DEPLOY_HOOKS);

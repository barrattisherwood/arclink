const VERCEL_TOKENS: Record<string, string> = {
  rugby_union: process.env['VERCEL_REVALIDATE_TOKEN_RUGBY']    ?? '',
  football:    process.env['VERCEL_REVALIDATE_TOKEN_FOOTBALL'] ?? '',
  cricket:     process.env['VERCEL_REVALIDATE_TOKEN_CRICKET']  ?? '',
  tennis:      process.env['VERCEL_REVALIDATE_TOKEN_TENNIS']   ?? '',
};

const SITE_URLS: Record<string, string> = {
  rugby_union: process.env['VERCEL_SITE_URL_RUGBY']    ?? 'https://sarugbybets.co.za',
  football:    process.env['VERCEL_SITE_URL_FOOTBALL'] ?? 'https://safootballbets.co.za',
  cricket:     process.env['VERCEL_SITE_URL_CRICKET']  ?? 'https://sacricketbets.co.za',
  tennis:      process.env['VERCEL_SITE_URL_TENNIS']   ?? 'https://satennisbets.co.za',
};

const SPORT_PATHS: Record<string, string[]> = {
  rugby_union: ['/articles', '/'],
  football:    ['/analysis', '/'],
  cricket:     ['/articles', '/'],
  tennis:      ['/analysis', '/'],
};

export async function revalidateSite(
  sportKey: string,
  extraPaths: string[] = [],
): Promise<void> {
  const token   = VERCEL_TOKENS[sportKey];
  const baseUrl = SITE_URLS[sportKey];

  if (!token || !baseUrl) {
    console.warn(`[Revalidate] No token or URL configured for sport: ${sportKey}`);
    return;
  }

  const paths = [
    ...(SPORT_PATHS[sportKey] ?? []),
    ...extraPaths,
  ];

  for (const path of paths) {
    try {
      const url = `${baseUrl}/api/revalidate?path=${encodeURIComponent(path)}&token=${token}`;
      const res = await fetch(url, { method: 'POST' });

      if (!res.ok) {
        console.error(`[Revalidate] Failed for ${path}:`, res.status, await res.text());
      } else {
        console.log(`[Revalidate] Cleared cache: ${baseUrl}${path}`);
      }
    } catch (err) {
      console.error(`[Revalidate] Error for ${path}:`, err);
    }
  }
}

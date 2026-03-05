import { IFeaturedImage } from '../models/Post';

const UNSPLASH_API = 'https://api.unsplash.com';

interface UnsplashPhoto {
  urls: { regular: string };
  alt_description: string | null;
  user: {
    name: string;
    links: { html: string };
  };
  links: { html: string };
}

async function searchUnsplash(keyword: string, accessKey: string): Promise<UnsplashPhoto | null> {
  const url = `${UNSPLASH_API}/search/photos?query=${encodeURIComponent(keyword)}&per_page=1&orientation=landscape`;

  const response = await fetch(url, {
    headers: { Authorization: `Client-ID ${accessKey}` },
  });

  if (!response.ok) {
    console.error('Unsplash API error:', response.status, 'for query:', keyword);
    return null;
  }

  const data = await response.json() as { results: UnsplashPhoto[] };
  return data.results[0] ?? null;
}

export async function fetchUnsplashImage(keyword: string, altText: string): Promise<IFeaturedImage | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    console.error('UNSPLASH_ACCESS_KEY is not set');
    return null;
  }

  const photo = await searchUnsplash(keyword, accessKey);

  if (!photo) return null;

  return {
    url: photo.urls.regular,
    alt: altText,
    credit: {
      photographer: photo.user.name,
      photographer_url: photo.user.links.html,
      unsplash_url: photo.links.html,
    },
  };
}

export async function fetchUnsplashImageWithFallbacks(keywords: string[], altText: string): Promise<IFeaturedImage | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    console.error('UNSPLASH_ACCESS_KEY is not set');
    return null;
  }

  for (const keyword of keywords) {
    const photo = await searchUnsplash(keyword, accessKey);
    if (photo) {
      return {
        url: photo.urls.regular,
        alt: altText,
        credit: {
          photographer: photo.user.name,
          photographer_url: photo.user.links.html,
          unsplash_url: photo.links.html,
        },
      };
    }
  }

  return null;
}

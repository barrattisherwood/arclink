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

export async function fetchUnsplashImage(keyword: string, altText: string): Promise<IFeaturedImage | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    console.error('UNSPLASH_ACCESS_KEY is not set');
    return null;
  }

  const url = `${UNSPLASH_API}/search/photos?query=${encodeURIComponent(keyword)}&per_page=1&orientation=landscape`;

  const response = await fetch(url, {
    headers: { Authorization: `Client-ID ${accessKey}` },
  });

  if (!response.ok) {
    console.error('Unsplash API error:', response.status);
    return null;
  }

  const data = await response.json() as { results: UnsplashPhoto[] };

  if (!data.results.length) return null;

  const photo = data.results[0];

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

export interface TitleSuggestion {
  title: string;
  rationale: string;
}

export interface QueueItem {
  id: string;
  title: string;
  priority: number;
  notes: string | null;
  created_at: string;
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  seo_title: string;
  seo_description: string;
  categories: string[];
  reading_time: number;
  status: 'draft' | 'scheduled' | 'published';
  tags: string[];
  word_count: number;
  generated: boolean;
  scheduled_for: string | null;
  published_at: string | null;
  created_at: string;
  content?: string;
  featured_image: {
    url: string;
    alt: string;
    credit?: { photographer: string; photographer_url: string; unsplash_url: string } | null;
  } | null;
}

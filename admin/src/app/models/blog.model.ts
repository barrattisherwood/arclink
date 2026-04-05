export interface TitleSuggestion {
  title: string;
  rationale: string;
}

export interface FixtureEntry {
  homeTeam: string;
  awayTeam: string;
  competition: string;
  venue: string;
  kickoff: string;
  matchLabel: string;
}

export interface QueueItem {
  id: string;
  title: string;
  priority: number;
  notes: string | null;
  persona_tag: string | null;
  fixtures: FixtureEntry[];
  created_at: string;
}

export interface DialogueBlock {
  persona: string;
  content: string;
  order: number;
}

export interface FixtureDialogue {
  matchLabel: string;
  blocks: DialogueBlock[];
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
  article_format?: 'standard' | 'dialogue' | 'weekly-roundup';
  dialogue_blocks?: DialogueBlock[];
  fixture_dialogues?: FixtureDialogue[];
  fixture_list?: FixtureEntry[];
  featured?: boolean;
  featured_image: {
    url: string;
    alt: string;
    credit?: { photographer: string; photographer_url: string; unsplash_url: string } | null;
  } | null;
}

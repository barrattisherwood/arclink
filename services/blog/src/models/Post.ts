import { Schema, model, Document } from 'mongoose';

export interface IFeaturedImage {
  url: string;
  alt: string;
  credit?: {
    photographer: string;
    photographer_url: string;
    unsplash_url: string;
  } | null;
}

export interface IDialogueBlock {
  persona: string;
  content: string;
  order: number;
}

export interface IFixtureEntry {
  homeTeam: string;
  awayTeam: string;
  competition: string;
  venue: string;
  kickoff: string;
  matchLabel: string;
}

export interface IFixtureDialogue {
  matchLabel: string;
  blocks: IDialogueBlock[];
}

export interface IPost extends Document {
  id: string;
  tenant_id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  seo_title: string;
  seo_description: string;
  categories: string[];
  reading_time: number;
  status: 'draft' | 'scheduled' | 'published';
  scheduled_for: Date | null;
  published_at: Date | null;
  tags: string[];
  featured_image: IFeaturedImage | null;
  word_count: number;
  generated: boolean;
  article_format: 'standard' | 'dialogue' | 'weekly-roundup';
  dialogue_blocks: IDialogueBlock[];
  fixture_dialogues: IFixtureDialogue[];
  fixture_list: IFixtureEntry[];
  featured: boolean;
  created_at: Date;
}

const PostSchema = new Schema<IPost>({
  id: { type: String, required: true, unique: true },
  tenant_id: { type: String, required: true, index: true },
  title: { type: String, required: true },
  slug: { type: String, required: true },
  excerpt: { type: String, required: true },
  content: { type: String, required: true },
  status: { type: String, enum: ['draft', 'scheduled', 'published'], required: true, default: 'draft' },
  scheduled_for: { type: Date, default: null },
  published_at: { type: Date, default: null },
  tags: { type: [String], default: [] },
  featured_image: {
    type: new Schema({
      url: { type: String, required: true },
      alt: { type: String, required: true },
      credit: {
        type: new Schema({
          photographer: { type: String },
          photographer_url: { type: String },
          unsplash_url: { type: String },
        }),
        default: null,
      },
    }),
    default: null,
  },
  seo_title: { type: String, default: '' },
  seo_description: { type: String, default: '' },
  categories: { type: [String], default: [] },
  reading_time: { type: Number, default: 0 },
  word_count: { type: Number, required: true, default: 0 },
  generated: { type: Boolean, required: true, default: false },
  article_format: { type: String, enum: ['standard', 'dialogue', 'weekly-roundup'], default: 'standard' },
  dialogue_blocks: {
    type: [{
      persona: { type: String, required: true },
      content: { type: String, required: true },
      order: { type: Number, required: true },
    }],
    default: [],
  },
  fixture_dialogues: {
    type: [{
      matchLabel: { type: String, required: true },
      blocks: [{
        persona: { type: String, required: true },
        content: { type: String, required: true },
        order: { type: Number, required: true },
      }],
    }],
    default: [],
  },
  fixture_list: {
    type: [{
      homeTeam: { type: String, required: true },
      awayTeam: { type: String, required: true },
      competition: { type: String, default: '' },
      venue: { type: String, default: '' },
      kickoff: { type: String, default: '' },
      matchLabel: { type: String, required: true },
    }],
    default: [],
  },
  featured: { type: Boolean, default: false },
  created_at: { type: Date, required: true, default: Date.now },
});

PostSchema.index({ tenant_id: 1, slug: 1 }, { unique: true });
PostSchema.index({ tenant_id: 1, status: 1, scheduled_for: 1 });

export const Post = model<IPost>('Post', PostSchema);

import { Schema, model, Document } from 'mongoose';

export interface IFeaturedImage {
  url: string;
  alt: string;
  credit: {
    photographer: string;
    photographer_url: string;
    unsplash_url: string;
  };
}

export interface IPost extends Document {
  id: string;
  tenant_id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  status: 'draft' | 'scheduled' | 'published';
  scheduled_for: Date | null;
  published_at: Date | null;
  tags: string[];
  featured_image: IFeaturedImage | null;
  word_count: number;
  generated: boolean;
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
        photographer: { type: String, required: true },
        photographer_url: { type: String, required: true },
        unsplash_url: { type: String, required: true },
      },
    }),
    default: null,
  },
  word_count: { type: Number, required: true, default: 0 },
  generated: { type: Boolean, required: true, default: false },
  created_at: { type: Date, required: true, default: Date.now },
});

PostSchema.index({ tenant_id: 1, slug: 1 }, { unique: true });
PostSchema.index({ tenant_id: 1, status: 1, scheduled_for: 1 });

export const Post = model<IPost>('Post', PostSchema);

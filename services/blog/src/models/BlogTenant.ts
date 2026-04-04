import { Schema, model, Document } from 'mongoose';

export interface IBlogTenant extends Document {
  id: string;
  api_key: string;
  name: string;
  allowed_origin: string;
  active: boolean;
  blog_subject: string;
  blog_audience: string;
  blog_tone: string;
  blog_word_count: number;
  blog_cadence: number;
  blog_publish_day: number;
  blog_publish_hour: number;
  blog_predefined_tags: string[];
  blog_predefined_categories: string[];
  blog_canonical_base: string;
  blog_persona_prompts: Map<string, string>;
  created_at: Date;
}

const BlogTenantSchema = new Schema<IBlogTenant>({
  id: { type: String, required: true, unique: true },
  api_key: { type: String, required: true },
  name: { type: String, required: true },
  allowed_origin: { type: String, required: true },
  active: { type: Boolean, required: true, default: true },
  blog_subject: { type: String, required: true },
  blog_audience: { type: String, required: true },
  blog_tone: { type: String, required: true },
  blog_word_count: { type: Number, required: true, default: 1500 },
  blog_cadence: { type: Number, required: true, default: 1 },
  blog_publish_day: { type: Number, required: true, default: 2 },
  blog_publish_hour: { type: Number, required: true, default: 9 },
  blog_predefined_tags: { type: [String], default: [] },
  blog_predefined_categories: { type: [String], default: [] },
  blog_canonical_base: { type: String, default: '' },
  blog_persona_prompts: { type: Map, of: String, default: new Map() },
  created_at: { type: Date, required: true, default: Date.now },
});

export const BlogTenant = model<IBlogTenant>('BlogTenant', BlogTenantSchema);

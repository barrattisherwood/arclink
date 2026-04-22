import mongoose, { Schema, Document } from 'mongoose';

export interface IContentEntry extends Document {
  siteId: string;
  contentTypeSlug: string;
  slug: string;
  published: boolean;
  data: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const ContentEntrySchema = new Schema<IContentEntry>(
  {
    siteId: { type: String, required: true },
    contentTypeSlug: { type: String, required: true },
    slug: { type: String, required: true },
    published: { type: Boolean, default: false },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const ContentEntry = mongoose.model<IContentEntry>('ContentEntry', ContentEntrySchema);

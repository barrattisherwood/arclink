import mongoose, { Schema, Document } from 'mongoose';

export interface IContentEntry extends Document {
  siteId: string;
  contentTypeId: mongoose.Types.ObjectId;
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
    contentTypeId: { type: Schema.Types.ObjectId, ref: 'ContentType', required: true },
    contentTypeSlug: { type: String, required: true },
    slug: { type: String, required: true },
    published: { type: Boolean, default: false },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ContentEntrySchema.index({ siteId: 1, contentTypeSlug: 1, slug: 1 }, { unique: true });
ContentEntrySchema.index({ siteId: 1, contentTypeSlug: 1, published: 1 });

export const ContentEntry = mongoose.model<IContentEntry>('ContentEntry', ContentEntrySchema);

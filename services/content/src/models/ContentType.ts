import mongoose, { Schema, Document } from 'mongoose';

export type FieldType =
  | 'text'
  | 'richtext'
  | 'url'
  | 'image'
  | 'images'
  | 'video_url'
  | 'coordinates'
  | 'boolean'
  | 'select'
  | 'date'
  | 'tags';

export interface IFieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  order: number;
  helpText?: string;
}

export interface IContentType extends Document {
  siteId: string;
  name: string;
  slug: string;
  fields: IFieldDefinition[];
  createdAt: Date;
  updatedAt: Date;
}

const FieldDefinitionSchema = new Schema<IFieldDefinition>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, required: true },
    required: { type: Boolean, default: false },
    options: [{ type: String }],
    order: { type: Number, default: 0 },
    helpText: { type: String },
  },
  { _id: false }
);

const ContentTypeSchema = new Schema<IContentType>(
  {
    siteId: { type: String, required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    fields: [FieldDefinitionSchema],
  },
  { timestamps: true }
);

ContentTypeSchema.index({ siteId: 1, slug: 1 }, { unique: true });

export const ContentType = mongoose.model<IContentType>('ContentType', ContentTypeSchema);

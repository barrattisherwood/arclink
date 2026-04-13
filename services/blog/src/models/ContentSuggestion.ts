import { Schema, model, Document } from 'mongoose';

export interface IContentSuggestion extends Document {
  id: string;
  tenant_id: string;
  title: string;
  content_type: string;
  persona_tag: string | null;
  fixture_date: string | null;
  fixture_label: string | null;
  competition: string;
  generate_at: Date;
  publish_at: Date;
  reason: string;
  status: 'pending' | 'approved' | 'dismissed';
  created_at: Date;
}

const ContentSuggestionSchema = new Schema<IContentSuggestion>({
  id:            { type: String, required: true, unique: true },
  tenant_id:     { type: String, required: true, index: true },
  title:         { type: String, required: true },
  content_type:  { type: String, required: true },
  persona_tag:   { type: String, default: null },
  fixture_date:  { type: String, default: null },
  fixture_label: { type: String, default: null },
  competition:   { type: String, default: '' },
  generate_at:   { type: Date, required: true },
  publish_at:    { type: Date, required: true },
  reason:        { type: String, default: '' },
  status:        { type: String, enum: ['pending', 'approved', 'dismissed'], default: 'pending' },
  created_at:    { type: Date, default: Date.now },
});

ContentSuggestionSchema.index({ tenant_id: 1, status: 1 });

export const ContentSuggestion = model<IContentSuggestion>('ContentSuggestion', ContentSuggestionSchema);

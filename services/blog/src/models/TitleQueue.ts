import { Schema, model, Document } from 'mongoose';
import { IFixtureEntry } from './Post';

export interface ITitleQueue extends Document {
  id: string;
  tenant_id: string;
  title: string;
  priority: number;
  notes: string | null;
  persona_tag: string | null;
  fixtures: IFixtureEntry[];
  is_weekly_roundup: boolean;
  // Scheduling fields (Phase 1 calendar)
  content_type: 'article' | 'weekly-roundup';
  schedule_status: 'pending' | 'generating' | 'generated' | 'failed';
  generate_at: Date | null;
  publish_at: Date | null;
  fixture_date: string | null;
  fixture_label: string | null;
  competition: string | null;
  generated_post_id: string | null;
  created_at: Date;
}

const TitleQueueSchema = new Schema<ITitleQueue>({
  id: { type: String, required: true, unique: true },
  tenant_id: { type: String, required: true, index: true },
  title: { type: String, required: true },
  priority: { type: Number, required: true, default: 0 },
  notes: { type: String, default: null },
  persona_tag: { type: String, default: null },
  is_weekly_roundup: { type: Boolean, default: false },
  content_type: { type: String, enum: ['article', 'weekly-roundup'], default: 'article' },
  schedule_status: { type: String, enum: ['pending', 'generating', 'generated', 'failed'], default: 'pending' },
  generate_at: { type: Date, default: null },
  publish_at: { type: Date, default: null },
  fixture_date: { type: String, default: null },
  fixture_label: { type: String, default: null },
  competition: { type: String, default: null },
  generated_post_id: { type: String, default: null },
  fixtures: {
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
  created_at: { type: Date, required: true, default: Date.now },
});

TitleQueueSchema.index({ tenant_id: 1, priority: 1 });
TitleQueueSchema.index({ schedule_status: 1, generate_at: 1 });

export const TitleQueue = model<ITitleQueue>('TitleQueue', TitleQueueSchema);

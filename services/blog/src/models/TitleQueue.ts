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
  created_at: Date;
}

const TitleQueueSchema = new Schema<ITitleQueue>({
  id: { type: String, required: true, unique: true },
  tenant_id: { type: String, required: true, index: true },
  title: { type: String, required: true },
  priority: { type: Number, required: true, default: 0 },
  notes: { type: String, default: null },
  persona_tag: { type: String, default: null },
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

export const TitleQueue = model<ITitleQueue>('TitleQueue', TitleQueueSchema);

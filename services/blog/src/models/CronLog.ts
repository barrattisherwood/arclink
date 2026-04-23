import { Schema, model, Document } from 'mongoose';

export interface ICronLog extends Document {
  job: string;
  startedAt: Date;
  finishedAt?: Date;
  status: 'running' | 'success' | 'skipped' | 'failed';
  fixturesFound: number;
  fixturesSelected: number;
  postTitle?: string;
  error?: string;
}

const CronLogSchema = new Schema<ICronLog>({
  job:               { type: String, required: true },
  startedAt:         { type: Date, required: true },
  finishedAt:        { type: Date },
  status:            { type: String, enum: ['running', 'success', 'skipped', 'failed'], required: true },
  fixturesFound:     { type: Number, default: 0 },
  fixturesSelected:  { type: Number, default: 0 },
  postTitle:         { type: String },
  error:             { type: String },
});

CronLogSchema.index({ job: 1, startedAt: -1 });

export const CronLog = model<ICronLog>('CronLog', CronLogSchema);

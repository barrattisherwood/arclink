import { Schema, model, Document } from 'mongoose';

export interface ICronLog extends Document {
  job: string;
  startedAt: Date;
  finishedAt?: Date;
  status: 'running' | 'success' | 'partial' | 'failed';
  fixturesSynced: number;
  syncErrors: Array<{ competition: string; message: string }>;
}

const CronLogSchema = new Schema<ICronLog>({
  job:            { type: String, required: true },
  startedAt:      { type: Date, required: true },
  finishedAt:     { type: Date },
  status:         { type: String, enum: ['running', 'success', 'partial', 'failed'], required: true },
  fixturesSynced: { type: Number, default: 0 },
  syncErrors:     { type: [{ competition: String, message: String }], default: [] },
});

CronLogSchema.index({ job: 1, startedAt: -1 });

export const CronLog = model<ICronLog>('CronLog', CronLogSchema);

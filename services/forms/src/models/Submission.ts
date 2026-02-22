import { Schema, model, Document } from 'mongoose';

export interface ISubmission extends Document {
  tenant_id: string;
  tenant_name: string;
  fields: Record<string, unknown>;
  submitted_at: Date;
}

const SubmissionSchema = new Schema<ISubmission>({
  tenant_id: { type: String, required: true, index: true },
  tenant_name: { type: String, required: true },
  fields: { type: Schema.Types.Mixed, required: true },
  submitted_at: { type: Date, required: true, default: Date.now },
});

export const Submission = model<ISubmission>('Submission', SubmissionSchema);

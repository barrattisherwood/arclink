import { Schema, model, Document } from 'mongoose';

export interface ITenant extends Document {
  id: string;
  api_key: string;
  name: string;
  allowed_origin: string;
  recipient_email: string;
  recipient_field?: string;
  reply_to_field: string;
  brand_color?: string;
  rate_limit: number;
  active: boolean;
  created_at: Date;
}

const TenantSchema = new Schema<ITenant>({
  id: { type: String, required: true, unique: true },
  api_key: { type: String, required: true },
  name: { type: String, required: true },
  allowed_origin: { type: String, required: true },
  recipient_email: { type: String, required: true },
  recipient_field: { type: String, required: false },
  reply_to_field: { type: String, required: true },
  brand_color: { type: String, required: false },
  rate_limit: { type: Number, required: true, default: 10 },
  active: { type: Boolean, required: true, default: true },
  created_at: { type: Date, required: true, default: Date.now },
});

export const Tenant = model<ITenant>('Tenant', TenantSchema);

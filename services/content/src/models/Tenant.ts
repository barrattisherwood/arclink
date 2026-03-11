import mongoose, { Schema, Document } from 'mongoose';

export interface IContentTenant extends Document {
  siteId: string;
  name: string;
  domain: string;
  adminUsers: string[];
  api_key: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ContentTenantSchema = new Schema<IContentTenant>(
  {
    siteId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    domain: { type: String, required: true },
    adminUsers: [{ type: String }],
    api_key: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const ContentTenant = mongoose.model<IContentTenant>('ContentTenant', ContentTenantSchema);

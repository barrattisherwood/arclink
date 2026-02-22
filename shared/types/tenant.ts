export interface Tenant {
  id: string;
  api_key: string;
  name: string;
  allowed_origin: string;
  recipient_email: string;
  reply_to_field: string;
  rate_limit: number;
  active: boolean;
  created_at: Date;
}

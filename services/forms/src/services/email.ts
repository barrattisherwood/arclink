import { Resend } from 'resend';
import { ITenant } from '../models/Tenant';

const resend = new Resend(process.env.RESEND_API_KEY);

function buildEmailBody(fields: Record<string, unknown>): string {
  return Object.entries(fields)
    .filter(([key]) => key !== 'cf-turnstile-response')
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join('\n');
}

export async function sendFormEmail(tenant: ITenant, body: Record<string, unknown>): Promise<void> {
  const replyTo = body[tenant.reply_to_field];
  const replyToEmail = typeof replyTo === 'string' ? replyTo : undefined;

  const { error } = await resend.emails.send({
    from: 'forms@arclink.dev',
    to: tenant.recipient_email,
    subject: `New form submission — ${tenant.name}`,
    text: buildEmailBody(body),
    ...(replyToEmail ? { replyTo: replyToEmail } : {}),
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

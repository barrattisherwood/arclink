import { Resend } from 'resend';
import { ITenant } from '../models/Tenant';

const resend = new Resend(process.env.RESEND_API_KEY);

const DEFAULT_BRAND_COLOR = '#111111';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function buildFieldRows(fields: Record<string, unknown>): string {
  return Object.entries(fields)
    .map(([key, value]) => {
      const label = escapeHtml(formatKey(key));
      const val = escapeHtml(String(value)).replace(/\n/g, '<br>');
      return `
        <div style="margin-bottom:20px;">
          <p style="color:#888888;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${label}</p>
          <p style="color:#111111;font-size:15px;margin:0;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${val}</p>
        </div>`;
    })
    .join('');
}

function buildEmailHtml(tenant: ITenant, fields: Record<string, unknown>): string {
  const brandColor = tenant.brand_color ?? DEFAULT_BRAND_COLOR;
  const tenantName = escapeHtml(tenant.name);
  const fieldRows = buildFieldRows(fields);
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:6px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.10);">

          <!-- Brand accent bar -->
          <tr>
            <td height="5" style="background:${brandColor};font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 20px;">
              <h1 style="color:#111111;font-size:22px;font-weight:700;margin:0 0 5px;letter-spacing:-0.01em;">${tenantName}</h1>
              <p style="color:#999999;font-size:13px;margin:0;">New form submission</p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;"><div style="height:1px;background:#eeeeee;"></div></td>
          </tr>

          <!-- Fields -->
          <tr>
            <td style="padding:28px 40px 12px;">
              ${fieldRows}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9f9f9;padding:16px 40px;border-top:1px solid #eeeeee;">
              <p style="color:#bbbbbb;font-size:11px;margin:0;text-align:center;">
                Sent via <a href="https://arclink.dev" style="color:#999999;text-decoration:none;">arclink</a> &mdash; &copy; ${year}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildEmailText(fields: Record<string, unknown>): string {
  return Object.entries(fields)
    .map(([key, value]) => `${formatKey(key)}: ${String(value)}`)
    .join('\n');
}

function buildConfirmationHtml(tenant: ITenant): string {
  const brandColor = tenant.brand_color ?? DEFAULT_BRAND_COLOR;
  const tenantName = escapeHtml(tenant.name);
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:6px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.10);">

          <!-- Brand accent bar -->
          <tr>
            <td height="5" style="background:${brandColor};font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h1 style="color:#111111;font-size:22px;font-weight:700;margin:0 0 16px;letter-spacing:-0.01em;">${tenantName}</h1>
              <p style="color:#444444;font-size:15px;line-height:1.7;margin:0 0 12px;">Thanks for getting in touch. We&rsquo;ve received your message and will get back to you soon.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9f9f9;padding:16px 40px;border-top:1px solid #eeeeee;">
              <p style="color:#bbbbbb;font-size:11px;margin:0;text-align:center;">
                Sent via <a href="https://arclink.dev" style="color:#999999;text-decoration:none;">arclink</a> &mdash; &copy; ${year}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildConfirmationText(tenant: ITenant): string {
  return `${tenant.name}\n\nThanks for getting in touch. We've received your message and will get back to you soon.`;
}

export async function sendFormEmail(tenant: ITenant, body: Record<string, unknown>): Promise<void> {
  const replyTo = body[tenant.reply_to_field];
  const replyToEmail = typeof replyTo === 'string' ? replyTo : undefined;

  const dynamicTo = tenant.recipient_field ? body[tenant.recipient_field] : undefined;
  const to = typeof dynamicTo === 'string' ? dynamicTo : tenant.recipient_email;

  // Strip internal fields before rendering
  const { 'cf-turnstile-response': _token, ...fields } = body;

  const { error } = await resend.emails.send({
    from: 'forms@arclink.dev',
    to,
    subject: `New form submission — ${tenant.name}`,
    html: buildEmailHtml(tenant, fields),
    text: buildEmailText(fields),
    ...(replyToEmail ? { replyTo: replyToEmail } : {}),
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  if (tenant.confirmation_enabled && replyToEmail) {
    const confirmSubject = tenant.confirmation_subject ?? `Thanks for your message — ${tenant.name}`;
    const { error: confirmError } = await resend.emails.send({
      from: 'forms@arclink.dev',
      to: replyToEmail,
      subject: confirmSubject,
      html: buildConfirmationHtml(tenant),
      text: buildConfirmationText(tenant),
    });

    if (confirmError) {
      throw new Error(`Resend confirmation error: ${confirmError.message}`);
    }
  }
}

// Create the mock inside the factory to avoid jest hoisting / TDZ issues.
// Attach it to the constructor so tests can retrieve a stable reference.
jest.mock('resend', () => {
  const send = jest.fn();
  const MockResend = jest.fn(() => ({ emails: { send } }));
  (MockResend as any).__send = send;
  return { Resend: MockResend };
});

import { sendFormEmail } from './email';
import { Resend } from 'resend';
import { ITenant } from '../models/Tenant';

const mockSend = (Resend as any).__send as jest.Mock;

function makeTenant(overrides: Partial<ITenant> = {}): ITenant {
  return {
    id: 'tenant-1',
    api_key: 'hashed',
    name: 'Test Tenant',
    allowed_origin: 'https://example.com',
    recipient_email: 'admin@example.com',
    reply_to_field: 'email',
    rate_limit: 10,
    active: true,
    created_at: new Date(),
    ...overrides,
  } as ITenant;
}

beforeEach(() => {
  mockSend.mockReset();
  mockSend.mockResolvedValue({ error: null });
});

describe('sendFormEmail', () => {
  describe('recipient routing', () => {
    it('uses recipient_email when recipient_field is not set', async () => {
      const tenant = makeTenant();
      await sendFormEmail(tenant, { name: 'Alice', email: 'alice@test.com' });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'admin@example.com' }),
      );
    });

    it('uses body[recipient_field] when set and present in body', async () => {
      const tenant = makeTenant({ recipient_field: 'provider_email' });
      await sendFormEmail(tenant, {
        name: 'Alice',
        email: 'alice@test.com',
        provider_email: 'provider@example.com',
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'provider@example.com' }),
      );
    });

    it('falls back to recipient_email when recipient_field is set but missing from body', async () => {
      const tenant = makeTenant({ recipient_field: 'provider_email' });
      await sendFormEmail(tenant, { name: 'Alice', email: 'alice@test.com' });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'admin@example.com' }),
      );
    });

    it('falls back to recipient_email when recipient_field value is not a string', async () => {
      const tenant = makeTenant({ recipient_field: 'provider_email' });
      await sendFormEmail(tenant, { provider_email: 42, email: 'alice@test.com' });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'admin@example.com' }),
      );
    });
  });

  describe('reply-to', () => {
    it('sets replyTo from body[reply_to_field] when it is a string', async () => {
      const tenant = makeTenant();
      await sendFormEmail(tenant, { name: 'Alice', email: 'alice@test.com' });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ replyTo: 'alice@test.com' }),
      );
    });

    it('omits replyTo when reply_to_field is missing from body', async () => {
      const tenant = makeTenant();
      await sendFormEmail(tenant, { name: 'Alice' });

      const call = mockSend.mock.calls[0][0];
      expect(call).not.toHaveProperty('replyTo');
    });
  });

  describe('email body', () => {
    it('strips cf-turnstile-response from text and html', async () => {
      const tenant = makeTenant();
      await sendFormEmail(tenant, {
        name: 'Alice',
        email: 'alice@test.com',
        'cf-turnstile-response': 'secret-token',
      });

      const call = mockSend.mock.calls[0][0];
      expect(call.text).not.toContain('cf-turnstile-response');
      expect(call.html).not.toContain('cf-turnstile-response');
      expect(call.text).toContain('Name: Alice');
    });

    it('includes both html and text in the send call', async () => {
      const tenant = makeTenant();
      await sendFormEmail(tenant, { name: 'Alice', email: 'alice@test.com' });

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toBeDefined();
      expect(call.text).toBeDefined();
    });

    it('uses tenant brand_color in the html template', async () => {
      const tenant = makeTenant({ brand_color: '#ff5500' });
      await sendFormEmail(tenant, { name: 'Alice', email: 'alice@test.com' });

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('#ff5500');
    });

    it('falls back to default brand color when brand_color is not set', async () => {
      const tenant = makeTenant();
      await sendFormEmail(tenant, { name: 'Alice', email: 'alice@test.com' });

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('#111111');
    });

    it('includes tenant name in the html template', async () => {
      const tenant = makeTenant({ name: 'My Site' });
      await sendFormEmail(tenant, { email: 'alice@test.com' });

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('My Site');
    });

    it('escapes html entities in field values', async () => {
      const tenant = makeTenant();
      await sendFormEmail(tenant, { message: '<script>alert("xss")</script>' });

      const call = mockSend.mock.calls[0][0];
      expect(call.html).not.toContain('<script>');
      expect(call.html).toContain('&lt;script&gt;');
    });
  });

  describe('error handling', () => {
    it('throws when Resend returns an error', async () => {
      mockSend.mockResolvedValue({ error: { message: 'domain not verified' } });
      const tenant = makeTenant();

      await expect(
        sendFormEmail(tenant, { email: 'a@b.com' }),
      ).rejects.toThrow('Resend error: domain not verified');
    });
  });

  describe('confirmation email', () => {
    it('sends a second email to the submitter when confirmation_enabled is true', async () => {
      const tenant = makeTenant({ confirmation_enabled: true });
      await sendFormEmail(tenant, { name: 'Alice', email: 'alice@test.com' });

      expect(mockSend).toHaveBeenCalledTimes(2);
      const confirmCall = mockSend.mock.calls[1][0];
      expect(confirmCall.to).toBe('alice@test.com');
    });

    it('does not send a second email when confirmation_enabled is false', async () => {
      const tenant = makeTenant({ confirmation_enabled: false });
      await sendFormEmail(tenant, { name: 'Alice', email: 'alice@test.com' });

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('does not send a second email when reply_to_field is missing from body', async () => {
      const tenant = makeTenant({ confirmation_enabled: true });
      await sendFormEmail(tenant, { name: 'Alice' });

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('uses confirmation_subject when set', async () => {
      const tenant = makeTenant({ confirmation_enabled: true, confirmation_subject: 'We got your message!' });
      await sendFormEmail(tenant, { name: 'Alice', email: 'alice@test.com' });

      const confirmCall = mockSend.mock.calls[1][0];
      expect(confirmCall.subject).toBe('We got your message!');
    });

    it('falls back to default confirmation subject when confirmation_subject is not set', async () => {
      const tenant = makeTenant({ confirmation_enabled: true, name: 'My Site' });
      await sendFormEmail(tenant, { name: 'Alice', email: 'alice@test.com' });

      const confirmCall = mockSend.mock.calls[1][0];
      expect(confirmCall.subject).toBe('Thanks for your message — My Site');
    });

    it('uses tenant brand_color in the confirmation html', async () => {
      const tenant = makeTenant({ confirmation_enabled: true, brand_color: '#ff5500' });
      await sendFormEmail(tenant, { name: 'Alice', email: 'alice@test.com' });

      const confirmCall = mockSend.mock.calls[1][0];
      expect(confirmCall.html).toContain('#ff5500');
    });

    it('throws when Resend returns an error on the confirmation send', async () => {
      mockSend
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValueOnce({ error: { message: 'rate limit exceeded' } });

      const tenant = makeTenant({ confirmation_enabled: true });

      await expect(
        sendFormEmail(tenant, { name: 'Alice', email: 'alice@test.com' }),
      ).rejects.toThrow('Resend confirmation error: rate limit exceeded');
    });
  });
});

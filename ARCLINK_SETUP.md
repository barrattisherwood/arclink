# Arclink Forms Integration - Setup Guide

The arclink forms service has been integrated into Machinum's contact form. Follow these steps to complete the configuration.

## ✅ What's Been Implemented

- ✅ Forms service (`src/app/services/forms.service.ts`) with full arclink API integration
- ✅ Environment configuration file (`src/environment.ts`) for credentials
- ✅ Cloudflare Turnstile widget added to contact form
- ✅ TypeScript declarations for Turnstile API
- ✅ HttpClient provider configured in app config
- ✅ Error handling for all arclink error responses (401, 403, 404, 422, 429, 502)
- ✅ Form validation and user feedback

## 🔧 Configuration Steps Required

### 1. Register Machinum Tenant in Arclink

Run the seed script against your deployed arclink instance:

```bash
# SSH into your arclink server or use your deployment tool
npm run seed:tenant
```

Provide these details:
- **name**: `Machinum Agency Site`
- **allowed_origin**: `https://machinum.io`
- **recipient_email**: Your email address
- **reply_to_field**: `email`

**Save the output:**
- `tenantId` (UUID)
- `api_key` (plaintext - cannot be recovered later)

### 2. Get Cloudflare Turnstile Keys

1. Go to [Cloudflare Dashboard → Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile)
2. Create a new widget for `machinum.io`
3. Save both keys:
   - **Site Key** (public, safe to expose)
   - **Secret Key** (keep private, stored in arclink backend)

### 3. Configure Environment File

Update `src/environment.ts` with your actual credentials:

```typescript
export const environment = {
  production: false,
  arclink: {
    apiUrl: 'https://api.arclink.dev',
    tenantId: 'YOUR_ACTUAL_TENANT_ID_HERE',  // ← Replace this
    apiKey: 'YOUR_ACTUAL_API_KEY_HERE',       // ← Replace this
  },
  turnstile: {
    siteKey: 'YOUR_TURNSTILE_SITE_KEY_HERE',  // ← Replace this
  }
};
```

### 4. Add Turnstile Secret to Arclink Backend

The Turnstile **secret key** must be stored in your arclink backend configuration:

```bash
# In your arclink .env file
TURNSTILE_SECRET_KEY=your_turnstile_secret_key_here
```

## ⚠️ Security Warning

**IMPORTANT:** The current implementation exposes the arclink API key in client-side code. This is a security risk for production.

### Recommended Production Setup

For production, you have two options:

**Option A: Backend Proxy (Recommended)**
Create a simple backend endpoint that:
1. Receives form data from Machinum frontend
2. Adds the API key server-side
3. Forwards to arclink API

**Option B: Server-Side Rendering**
If you migrate to Next.js, Nuxt, or SvelteKit:
- Use a server action/API route
- Keep API key in server environment variables
- Never expose to browser

## 🧪 Testing

### Local Testing (Development)

1. Update `environment.ts` with your credentials
2. Run `ng serve`
3. Fill out the contact form at `localhost:4200/#contact`
4. Complete the Turnstile challenge
5. Submit and check for success/error messages

### Expected Behavior

**Success:**
- Button shows "SENDING..." → "MESSAGE SENT ✓"
- Form clears after 4 seconds
- Email arrives at your recipient address

**Errors:**
- Red error message appears below Turnstile widget
- Turnstile resets automatically
- Common errors:
  - "Please complete the security verification" → Turnstile not completed
  - "Too many requests..." → Rate limit (10/15min per IP)
  - "Authentication failed..." → Wrong API key
  - "Access forbidden..." → Wrong origin (must be `https://machinum.io` in production)

## 📋 Pre-Deployment Checklist

- [ ] Tenant registered in arclink (tenantId & apiKey obtained)
- [ ] Turnstile widget created (site key & secret key obtained)
- [ ] `src/environment.ts` updated with real credentials
- [ ] Turnstile secret key added to arclink backend
- [ ] Tested form submission locally
- [ ] Confirmed email delivery to recipient address
- [ ] (Optional) Implemented backend proxy for production security

## 🚀 Deployment Notes

When deploying to production:

1. **Update Origin**: Ensure arclink has `https://machinum.io` as the allowed origin
2. **Build Command**: `ng build --configuration production`
3. **Security**: Consider implementing a backend proxy (see Security Warning above)

## 📚 API Reference

### Arclink Response Codes

| Status | Meaning |
|--------|---------|
| 200 | Success - email sent |
| 401 | Missing or wrong `x-api-key` |
| 403 | Wrong Origin (not `https://machinum.io`) |
| 404 | Tenant not found or inactive |
| 422 | Missing or invalid Turnstile token |
| 429 | Rate limit hit (10 req / 15 min per IP) |
| 502 | Email send failed (Resend error) |

### Form Fields

All fields in the contact form are sent to arclink and included in the email:

- `name` - Sender's name
- `email` - Sender's email (used for Reply-To)
- `subject` - Optional project field
- `message` - Message content
- `cf-turnstile-response` - Turnstile token (required)

## � Database Scripts & Railway CLI — Agent Instructions

When an agent needs to run a seed script or any script requiring a live database connection:

**Always use `railway run` inside the service directory — never ask for or use the public MongoDB URI.**

The public MongoDB URL (`MONGO_PUBLIC_URL`) exposes credentials in plaintext on the command line and in shell history, and uses the root database user. It must not be used for script execution.

The correct pattern:

```bash
# 1. Navigate to the relevant service directory
cd services/blog   # or services/content, etc.

# 2. Link to the correct Railway service
railway service blog

# 3. Run the script — Railway injects private env vars automatically
railway run npx ts-node src/scripts/your-script.ts
```

`railway run` injects `MONGODB_URI` with the private internal hostname (`mongodb.railway.internal`), which is only routable inside Railway's private network. This keeps credentials off the command line entirely.

**If `railway run` fails with a DNS/connection error for the internal hostname**, the script must be run as a Railway job or one-off deploy — do not fall back to the public URI. Flag the issue to the developer instead.

---

## �🔗 Resources

- [Arclink Documentation](https://api.arclink.dev/docs)
- [Cloudflare Turnstile Docs](https://developers.cloudflare.com/turnstile/)
- [Machinum Contact Form](src/app/components/contact.component.ts)
- [Forms Service](src/app/services/forms.service.ts)

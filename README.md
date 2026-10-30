# NEMORA inbox

Receives messages from the contact form on nemora.uk and keeps them in a private admin at `/admin`, so enquiries arrive here instead of opening the visitor's email app.

Runs as one Cloudflare Worker with KV storage. **No passwords, keys or tokens are stored in this code.**

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/hobnob240/NemoraAgency/tree/main/_inbox)

## Set up from a phone

1. Open the Deploy to Cloudflare link above and sign in to Cloudflare.
2. Connect GitHub if asked. Keep the name **nemora-inbox**.
3. Leave the storage as **Create new**. For **SETUP_CODE**, make up a phrase of 8 or more characters and keep it private.
4. Press **Create and deploy** and wait for it to finish.
5. Open `https://nemora-inbox.<your-subdomain>.workers.dev/admin`, enter the setup code, and choose a username and a password of at least 12 characters.
6. Once you're logged in, you can delete the SETUP_CODE secret in Cloudflare. Setup can't run again while a login exists.

The contact form on nemora.uk sends to the address in `INBOX_URL` in the site build. If the inbox can't be reached, the form falls back to opening the visitor's email app, so no enquiry is lost.

## Optional email alert

Add a `RESEND_API_KEY` secret and an `ALERT_FROM` variable (a sender on a domain verified in Resend) to get a short email for each new message. The alert contains only the sender's name and business, never the message itself.

## Security

- Password stored only as a salted PBKDF2-SHA256 hash (100,000 rounds) in KV.
- `__Host-` session cookie: HttpOnly, Secure, SameSite=Strict, 8 hours.
- 5 wrong logins locks that connection out for 15 minutes; every login is logged under Activity.
- Admin requests must come from the admin's own page (Origin check); the contact form only accepts requests from nemora.uk (CORS allow-list).
- Spam protection: signed time-stamped form token, hidden honeypot field, 5 messages per hour per connection, 200 per day overall.
- Strict Content-Security-Policy, no inline scripts, frames denied, HSTS, noindex.
- Messages delete themselves after 2 years (privacy notice), and can be deleted any time from the admin.

## Forgotten password

In Cloudflare: Storage & databases, KV, the nemora-inbox namespace: delete `auth:user` and `auth:hash`. Add a SETUP_CODE secret again, then open `/admin` and set up a new login.

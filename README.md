# Gym Stars Hub

Tracks every class request from the first email to enrollment, for **Gym Stars Gymnastics** and **The Gym Nest**, and handles the messages along the way.

**Board stages** (worked out from the first-day date and status):

| Stage | When | What staff do |
|---|---|---|
| New Requests | No first day yet | Add to SportsEngine, send "spot is ready", call, set a first day |
| Upcoming First Days | First day is in the future | Nothing. A reminder goes out the evening before (if turned on) |
| First Day Today | First day is today | Mark who showed up |
| Follow-Up | First day has passed | Follow up, then set the status |
| Enrolled / Not Enrolled | Status is set | Done |

Other features: staff logins with an activity log of who did what, email (Resend) and text (Twilio) templates, automatic reminders and follow-ups, website form intake, paste-an-email intake, reports (funnel, by class, by month, gym comparison), and a gym switcher. Every row belongs to a gym, so more gyms can be added later.

**Stack:** Next.js 14 (App Router) on Vercel · Supabase (Postgres, Auth, row-level security) · Resend · Twilio · Tailwind.

---

## Setup (about 30 minutes, once)

### 1. Supabase (database and logins)
1. Create a project at supabase.com, choose the **US West** region, and save the database password somewhere safe.
2. **SQL Editor:** paste and run `supabase/migrations/0001_init.sql`, then `supabase/seed.sql`.
3. **Authentication → Sign In / Providers:** keep Email on, and turn **off** "Allow new users to sign up". Staff get in only by invite.
4. **Authentication → URL Configuration:** set **Site URL** to your app's address (for example `https://hub.gymstarsidaho.com`) and add `https://hub.gymstarsidaho.com/auth/callback` under Redirect URLs.
5. **Authentication → Emails:** edit these templates so their links point at the app. Staff sign in with email and password; invites and "Forgot password" send them to a page to set one.
   - **Invite user:** `<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&next=/set-password">Join Gym Stars Hub</a>`
   - **Reset Password:** `<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/set-password">Set a new password</a>`
   - **Magic Link** (not used by the sign-in page, but harmless to set): `<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink">Sign in to Gym Stars Hub</a>`
6. **Authentication → Users → Add user:** add your own email. Then run the "make me owner" block at the bottom of `seed.sql` with that email.
7. **Project Settings → API:** copy the URL, the `anon` key and the `service_role` key for step 3.

### 2. Resend (email)
1. Sign up at resend.com and add the domain **gymstarsidaho.com** (and **thegymneststudio.com** for The Gym Nest). Add the DNS records it shows you wherever those domains are managed.
2. Create an API key.
3. In the app, go to **Settings → Gym details → Send emails from** and use an address on that domain, such as `Gym Stars Gymnastics <hello@gymstarsidaho.com>`. Parent replies go to the reply-to email.

### 3. Vercel (hosting)
1. **Add New → Project → Import** this GitHub repo. The defaults are fine.
2. Under **Environment Variables**, add everything in `.env.example`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `RESEND_API_KEY`, `CRON_SECRET` (any long random string), and later `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`.
3. Deploy. To use `hub.gymstarsidaho.com`, go to **Settings → Domains** and add it.
4. The daily reminder job in `vercel.json` runs at 23:00 UTC (4–5 PM in Boise). Vercel sends `CRON_SECRET` with it automatically.

### 4. Twilio (texts), when you're ready
1. Buy a local 208 number, then complete **A2P 10DLC** registration (brand + campaign). Carriers block business texts until it's approved, which can take a week or more.
2. Add `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` in Vercel, and put the number (`+12085551234`) in **Settings → Texting number**.
3. Texts only go to families marked **"agreed to texts."** Collect that consent with a checkbox on your website form, and keep "Reply STOP to opt out" in the first text.

### 5. Connect the website form
In **Settings → Website form** you'll find this gym's intake address and private key. In the server code that already handles your class request form (the API route that sends you the email), add a `fetch` call like the one shown there. Requests then land on the board right away, with source "website". If the call fails, the email still reaches you, and you can paste it into **Add request**.

Fields accepted: `class`, `requested_time`, `parent`, `email`, `phone`, `zip`, `sms_opt_in`, `notes`, `children: [{ name, birthday }]`, and an optional `id` to prevent duplicates.

---

## Development

```bash
cp .env.example .env.local   # fill in your Supabase keys
npm install
npm run dev                  # http://localhost:3000
npm test                     # unit tests (stages, email parsing, dates, templates, reports)
npm run typecheck
```

### Layout
- `supabase/migrations/` – schema and row-level security (staff only see their own gyms)
- `src/lib/` – stages, parsing, dates, templates, messaging, reports
- `src/app/[gym]/` – board, request detail, add request, reports, settings, server actions
- `src/app/api/intake/[gym]` – website form intake · `src/app/api/cron/daily` – reminders and follow-ups

### Ideas for later
Parent-facing booking page, SportsEngine sync, two-way texting inbox, waitlist, coach assignments, class capacity, and from there, billing and full gym management.

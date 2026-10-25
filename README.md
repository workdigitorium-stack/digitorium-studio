# Digitorium Studio

The admin app for [digitorium.in](https://www.digitorium.in). The full plan is in
[`docs/studio-plan.html`](docs/studio-plan.html). This repo holds **phase 1** and
**phase 2** (every page of the site, and Brand) and **phase 3** (SEO and the blog):

| Screen | What it does |
|---|---|
| Dashboard | Leads waiting for a reply, today and last 7 days, recent uploads, activity log |
| Leads | One inbox for the lead popup, contact form and client discovery form. Status (New, Contacted, Won, Lost), notes, one-tap call / WhatsApp / email, CSV export. New leads appear live while the Studio is open, with an optional device alert. |
| Media | The site's photo and video library (`videos/<client>/<section>/<file>` in Supabase). Upload, rename, add a cover to a video, delete to a 30-day bin, restore. Changes show on the site within a minute. |
| Pages → Home | Every word on the home page, section by section. Hide a section, add, remove and reorder clients, case studies, industries and questions. |
| Pages → every other page | Services and the six service pages, Work and the six case studies, About, Contact, Privacy Policy, Terms. Every text, picture and link, in page order under its heading, with search, "Only changed" and Reset to original. |
| Brand | Logo, phone, WhatsApp and email, the header's Services and Work menus, and the footer. Shows on every page. |
| Posts | The blog at www.digitorium.in/blog. Write with a toolbar (headings, bold, lists, links, quotes, pictures), cover, summary, category, tags and per-post SEO. Publish now or schedule a date; unpublish, history and restore, delete. |
| SEO | For every page: title and description in Google (with a preview and length check), share picture, hide from Google, canonical. Redirects from old addresses. |
| Team | Invite by email with Owner, Admin, Editor or Viewer roles. Change roles, remove people. |
| Account | Set a password, sign out, install on phone. |

The lead popup, cookie banner and contact form's own labels are not editable yet.

## Publishing site text

- Every change in Pages or Brand **autosaves as a draft** (`public.site_content.draft`). Visitors do not see drafts.
- **Preview** opens the real page on digitorium.in with the draft showing, for the person who clicked it only.
  The site checks their Studio sign-in (`app/api/draft` in the website repo).
- **Publish** (owners and admins) copies the draft live and keeps a copy in `site_content_versions`.
  The site refreshes straight away (`app/api/revalidate` in the website repo), or within a minute if that call fails.
- **History** lists every publish. **Restore** puts an earlier one back live.
- The website keeps today's text in `app/content/defaults.json`, so a field nobody has saved still shows it.
- Home and Brand are forms described in [`lib/content.js`](lib/content.js). Every other page keeps its text in
  the website's code: the website's `scripts/content-slots.js` wrapped each text in `t(page, id, original)`, and the
  Studio document stores only the changed fields as `{ id: "new text" }`. The fields, labels and originals are in
  [`lib/site-pages/`](lib/site-pages) (one JSON per page). **After changing a page's text in the website's code**,
  regenerate them: `node scripts/content-slots.js ../digitorium-studio/lib/site-pages` (from the website repo). An id
  comes from the original text, so a Studio edit to a text whose original is later rewritten in code stops applying.
- Phone, WhatsApp and email written into those pages follow Brand automatically. Pictures and illustrations that
  are built into a section (the "What we do" cards, the step drawings) stay in the website's code; their text is editable.

## How it works

- **Next.js 16**, all screens are client components talking to Supabase from the browser.
- **No secrets in the browser.** The screens only hold the publishable key. (LinkedIn sharing is the one exception on the server: see below.) Every read and write is checked by
  row level security against `public.studio_members` (see `supabase/migrations/`).
- **Sign-in** is Supabase Auth: a one-time email link, or a password once set.
  The login page cannot create accounts. An invite (from Team) is what creates one.
- **The live site is untouched.** It already reads the same `videos` bucket and the same
  `leads` / `client_questionnaires` tables. Visitors still only insert.
- **Installable** as a phone app (manifest + service worker). The service worker caches nothing.

## Share blog posts on LinkedIn

A post with **Share on LinkedIn when it goes live** ticked is posted once to one
connected personal LinkedIn profile, as your text plus a link card (cover, title,
summary) to `www.digitorium.in/blog/<slug>`. Scheduled posts go out when someone opens
Posts after their time, or by the daily run at 10:00 India time (`vercel.json`).
The LinkedIn post is not changed if the blog post is edited later.

The LinkedIn token lives in `public.linkedin_account`, which only the server can read
(`app/api/linkedin`, `lib/linkedin-server.js`). Setup:

1. On [developer.linkedin.com](https://developer.linkedin.com/) create an app (it needs a
   LinkedIn company page to belong to). Under **Products** add **Sign In with LinkedIn
   using OpenID Connect** and **Share on LinkedIn**. Both are instant.
2. Under **Auth**, add the redirect URL `https://<studio domain>/api/linkedin/callback`.
3. In Vercel → Settings → Environment Variables add `LINKEDIN_CLIENT_ID`,
   `LINKEDIN_CLIENT_SECRET`, `SUPABASE_SECRET_KEY` (Supabase → Settings → API keys) and
   `CRON_SECRET` (any long random text). Optional: `LINKEDIN_VERSION` (API version, `YYYYMM`).
4. Redeploy, then an owner or admin opens **Account → LinkedIn → Connect LinkedIn**.

LinkedIn connections last 60 days. Account shows the date and warns in the last week;
Reconnect is one click.

## Roles

| | Owner | Admin | Editor | Viewer |
|---|---|---|---|---|
| Upload and edit media | Yes | Yes | Yes | No |
| Edit pages (saved as a draft) | Yes | Yes | Yes | No |
| Write blog posts (drafts) | Yes | Yes | Yes | No |
| Edit brand and SEO, publish, schedule, restore, delete posts | Yes | Yes | No | No |
| See and manage leads | Yes | Yes | No | Read only |
| Empty the media bin | Yes | Yes | No | No |
| Invite or remove people | Yes | No | No | No |

The database will not let the last owner be removed or demoted.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Optional environment variables (defaults point at the live project):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
```

## Deploy

1. Import this repo as a new Vercel project (framework: Next.js, no settings needed).
2. Add a domain, for example `studio.digitorium.in`.
3. In Supabase → Authentication → URL Configuration, add the Studio URL
   (e.g. `https://studio.digitorium.in/**`) to **Redirect URLs** and keep
   **Confirm email** switched on.
4. Sign in with the owner email (`officialdigitorium@gmail.com`) using an email link,
   then invite the team from **Team**.

Supabase's built-in email sender allows only a few emails an hour. For regular
invites, add your own SMTP under Authentication → Emails.

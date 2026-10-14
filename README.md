# Digitorium Studio

The admin app for [digitorium.in](https://digitorium.in). The full plan is in
[`docs/studio-plan.html`](docs/studio-plan.html). This repo holds **phase 1** and
the first part of **phase 2** (Pages → Home, and Brand):

| Screen | What it does |
|---|---|
| Dashboard | Leads waiting for a reply, today and last 7 days, recent uploads, activity log |
| Leads | One inbox for the lead popup, contact form and client discovery form. Status (New, Contacted, Won, Lost), notes, one-tap call / WhatsApp / email, CSV export. New leads appear live while the Studio is open, with an optional device alert. |
| Media | The site's photo and video library (`videos/<client>/<section>/<file>` in Supabase). Upload, rename, add a cover to a video, delete to a 30-day bin, restore. Changes show on the site within a minute. |
| Pages → Home | Every word on the home page, section by section. Hide a section, add, remove and reorder clients, case studies, industries and questions. |
| Brand | Logo, phone, WhatsApp and email, the header's Services and Work menus, and the footer. Shows on every page. |
| Team | Invite by email with Owner, Admin, Editor or Viewer roles. Change roles, remove people. |
| Account | Set a password, sign out, install on phone. |

The other pages (Services, Work, About, Contact) follow on the same system. SEO and Posts are
phases 3 and 4 and show as "Soon" in the menu.

## Publishing site text

- Every change in Pages or Brand **autosaves as a draft** (`public.site_content.draft`). Visitors do not see drafts.
- **Preview** opens the real page on digitorium.in with the draft showing, for the person who clicked it only.
  The site checks their Studio sign-in (`app/api/draft` in the website repo).
- **Publish** (owners and admins) copies the draft live and keeps a copy in `site_content_versions`.
  The site refreshes straight away (`app/api/revalidate` in the website repo), or within a minute if that call fails.
- **History** lists every publish. **Restore** puts an earlier one back live.
- The website keeps today's text in `app/content/defaults.json`, so a field nobody has saved still shows it.
- What each form contains is described in [`lib/content.js`](lib/content.js). Pictures and illustrations that
  are built into a section (the "What we do" cards, the step drawings) stay in the website's code; their text is editable.

## How it works

- **Next.js 16**, all screens are client components talking to Supabase from the browser.
- **No secrets.** The app only holds the publishable key. Every read and write is checked by
  row level security against `public.studio_members` (see `supabase/migrations/`).
- **Sign-in** is Supabase Auth: a one-time email link, or a password once set.
  The login page cannot create accounts. An invite (from Team) is what creates one.
- **The live site is untouched.** It already reads the same `videos` bucket and the same
  `leads` / `client_questionnaires` tables. Visitors still only insert.
- **Installable** as a phone app (manifest + service worker). The service worker caches nothing.

## Roles

| | Owner | Admin | Editor | Viewer |
|---|---|---|---|---|
| Upload and edit media | Yes | Yes | Yes | No |
| Edit pages (saved as a draft) | Yes | Yes | Yes | No |
| Edit brand, publish, restore | Yes | Yes | No | No |
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

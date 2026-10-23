-- Digitorium Studio: share blog posts on LinkedIn.
--
-- An owner or admin connects one personal LinkedIn profile under Account.
-- A post whose draft says { "linkedin": { "share": true, "text": "..." } }
-- is posted to that profile once it is live (now, or at its scheduled time).
-- The Studio's server (app/api/linkedin) does the posting with the service
-- role key; the browser never sees the LinkedIn token.

-- ---------------------------------------------------------------- the profile

-- One row: the connected profile. No grants at all, so only the service role
-- (the Studio's server) can read the token.
create table public.linkedin_account (
  id           int primary key default 1 check (id = 1),
  person_urn   text not null check (person_urn like 'urn:li:person:%'),
  name         text,
  access_token text not null,
  expires_at   timestamptz not null,
  connected_by text,
  connected_at timestamptz not null default now()
);
comment on table public.linkedin_account is 'The LinkedIn profile Studio shares blog posts to. Server only: holds the access token.';
alter table public.linkedin_account enable row level security;
revoke all on public.linkedin_account from anon, authenticated;

-- What the Studio screens may know about it: who, and until when. Never the token.
create function public.linkedin_status()
returns table(name text, expires_at timestamptz, connected_by text, connected_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.name, a.expires_at, a.connected_by, a.connected_at
  from public.linkedin_account a
  where public.studio_role() is not null;
$$;
revoke all on function public.linkedin_status() from public, anon;
grant execute on function public.linkedin_status() to authenticated;

-- ---------------------------------------------------------------- posts

-- Written by the server only (members may still update just the draft).
alter table public.posts
  add column linkedin_urn       text,
  add column linkedin_shared_at timestamptz,
  add column linkedin_error     text check (char_length(linkedin_error) <= 500),
  add column linkedin_claimed_at timestamptz;
comment on column public.posts.linkedin_urn is 'The LinkedIn post made for this blog post. Set once, so a post is never shared twice.';
comment on column public.posts.linkedin_claimed_at is 'When a share started, so two servers never share the same post at once.';

-- Digitorium Studio, phase 3: SEO and blog posts.
--
-- SEO is one more site_content document ("seo"), so it gets the same draft,
-- publish, history and restore as the pages:
--   { "pages":     { "/about/": { "title", "description", "image", "noindex", "canonical" } },
--     "redirects": [ { "from": "/old/", "to": "/new/", "permanent": true } ] }
-- Only owners and admins may change it (the plan's "Change brand, SEO,
-- settings"), like Brand.
--
-- Posts are rows of public.posts. Each holds a draft (edited in the Studio,
-- autosaved) and the published version the site shows from publish_at on,
-- so a post can be scheduled. publish_post() copies the draft live and
-- keeps a copy in post_versions. The draft is
--   { "title", "slug", "excerpt", "cover", "cover_alt", "category", "tags": [],
--     "body": <rich text as the editor's JSON>, "seo_title", "seo_description", "noindex" }
--
-- Who can do what:
--   write and edit post drafts      owner, admin, editor
--   publish, schedule, unpublish,
--   restore, delete a post          owner, admin
--   edit SEO                        owner, admin
--   read drafts and history         any member

-- ---------------------------------------------------------------- SEO

alter policy "members edit drafts" on public.site_content
  using (public.studio_role() in ('owner', 'admin') or (public.studio_role() = 'editor' and key not in ('brand', 'seo')))
  with check (public.studio_role() in ('owner', 'admin') or (public.studio_role() = 'editor' and key not in ('brand', 'seo')));

insert into public.site_content (key, draft, published, published_at, published_by, draft_updated_by)
values ('seo', '{"pages": {}, "redirects": []}', '{"pages": {}, "redirects": []}', now(), 'setup', 'setup')
on conflict (key) do nothing;

insert into public.site_content_versions (key, content, published_by, note)
select key, published, 'setup', 'Titles and descriptions as built'
from public.site_content where key = 'seo'
  and not exists (select 1 from public.site_content_versions where key = 'seo');

-- ---------------------------------------------------------------- posts

create table public.posts (
  id                 uuid primary key default gen_random_uuid(),
  slug               text unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  draft              jsonb not null default '{}' check (jsonb_typeof(draft) = 'object' and pg_column_size(draft) < 524288),
  published          jsonb,
  publish_at         timestamptz,
  first_published_at timestamptz,
  published_at       timestamptz,
  published_by       text,
  created_at         timestamptz not null default now(),
  created_by         text default lower(auth.jwt() ->> 'email'),
  draft_updated_at   timestamptz not null default now(),
  draft_updated_by   text default lower(auth.jwt() ->> 'email')
);
comment on table public.posts is 'Blog posts for digitorium.in/blog/. draft is what the Studio edits; published is live from publish_at.';
comment on column public.posts.slug is 'The live address, /blog/<slug>/. Set from the draft on publish.';
alter table public.posts enable row level security;

revoke all on public.posts from anon, authenticated;
grant select, delete on public.posts to authenticated;
grant insert (draft), update (draft) on public.posts to authenticated;

create policy "members read posts" on public.posts
  for select to authenticated using (public.studio_role() is not null);
create policy "writers add posts" on public.posts
  for insert to authenticated with check (public.studio_role() in ('owner', 'admin', 'editor'));
create policy "writers edit drafts" on public.posts
  for update to authenticated
  using (public.studio_role() in ('owner', 'admin', 'editor'))
  with check (public.studio_role() in ('owner', 'admin', 'editor'));
create policy "owners and admins delete posts" on public.posts
  for delete to authenticated using (public.studio_role() in ('owner', 'admin'));

create function public.posts_stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.draft is distinct from old.draft then
    new.draft_updated_at := now();
    new.draft_updated_by := lower(auth.jwt() ->> 'email');
  end if;
  return new;
end;
$$;
revoke all on function public.posts_stamp() from public, anon, authenticated;
create trigger posts_stamp before update on public.posts
  for each row execute function public.posts_stamp();

create table public.post_versions (
  id           bigint generated always as identity primary key,
  post_id      uuid not null references public.posts (id) on delete cascade,
  content      jsonb not null,
  published_at timestamptz not null default now(),
  published_by text,
  note         text check (char_length(note) <= 200)
);
create index post_versions_post_at on public.post_versions (post_id, published_at desc);
alter table public.post_versions enable row level security;
revoke all on public.post_versions from anon, authenticated;
grant select on public.post_versions to authenticated;
create policy "members read post history" on public.post_versions
  for select to authenticated using (public.studio_role() is not null);

-- Publishes the draft. p_at: when it goes live; null means now (or, for a
-- post that is already live, keep its original date and just update it).
create function public.publish_post(p_id uuid, p_at timestamptz default null) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  who  text := lower(auth.jwt() ->> 'email');
  p    public.posts;
  s    text;
  live timestamptz;
begin
  if coalesce(public.studio_role(), '') not in ('owner', 'admin') then
    raise exception 'Only an owner or admin can publish.' using errcode = '42501';
  end if;
  select * into p from public.posts where id = p_id for update;
  if not found then
    raise exception 'That post no longer exists.' using errcode = 'P0002';
  end if;
  s := p.draft ->> 'slug';
  if coalesce(trim(p.draft ->> 'title'), '') = '' then
    raise exception 'Give the post a title first.' using errcode = '22023';
  end if;
  if s is null or s !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(s) > 80 then
    raise exception 'The web address may only use small letters, numbers and dashes.' using errcode = '22023';
  end if;
  if exists (select 1 from public.posts where slug = s and id <> p_id) then
    raise exception 'Another post already uses /blog/%/.', s using errcode = '23505';
  end if;
  live := coalesce(p_at, case when p.published is not null and p.publish_at <= now() then p.publish_at else now() end);
  update public.posts
     set published = draft, slug = s, publish_at = live, published_at = now(), published_by = who,
         first_published_at = coalesce(first_published_at, live)
   where id = p_id;
  insert into public.post_versions (post_id, content, published_by, note)
  values (p_id, p.draft, who, case when live > now() then 'Scheduled for ' || to_char(live at time zone 'Asia/Kolkata', 'DD Mon YYYY, HH24:MI') end);
  return live;
end;
$$;

-- Takes a post off the site. The draft stays, and so does its address.
create function public.unpublish_post(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(public.studio_role(), '') not in ('owner', 'admin') then
    raise exception 'Only an owner or admin can unpublish.' using errcode = '42501';
  end if;
  update public.posts set published = null, publish_at = null where id = p_id;
end;
$$;

-- Puts an earlier published version back, as the draft and live.
create function public.restore_post_version(p_version bigint) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  who text := lower(auth.jwt() ->> 'email');
  v   public.post_versions;
begin
  if coalesce(public.studio_role(), '') not in ('owner', 'admin') then
    raise exception 'Only an owner or admin can restore a version.' using errcode = '42501';
  end if;
  select * into v from public.post_versions where id = p_version;
  if not found then
    raise exception 'That version no longer exists.' using errcode = 'P0002';
  end if;
  update public.posts
     set draft = v.content, published = v.content, slug = v.content ->> 'slug', published_at = now(), published_by = who,
         publish_at = coalesce(publish_at, now())
   where id = v.post_id;
  insert into public.post_versions (post_id, content, published_by, note)
  values (v.post_id, v.content, who, 'Restored the version from ' || to_char(v.published_at at time zone 'Asia/Kolkata', 'DD Mon YYYY, HH24:MI'));
  return v.post_id;
end;
$$;

revoke all on function public.publish_post(uuid, timestamptz) from public, anon;
revoke all on function public.unpublish_post(uuid) from public, anon;
revoke all on function public.restore_post_version(bigint) from public, anon;
grant execute on function public.publish_post(uuid, timestamptz) to authenticated;
grant execute on function public.unpublish_post(uuid) to authenticated;
grant execute on function public.restore_post_version(bigint) to authenticated;

-- What digitorium.in reads: live posts only, newest first.
create function public.site_posts()
returns table(slug text, content jsonb, publish_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.slug, p.published, p.publish_at, p.published_at
  from public.posts p
  where p.published is not null and p.publish_at <= now()
  order by p.publish_at desc;
$$;
revoke all on function public.site_posts() from public;
grant execute on function public.site_posts() to anon, authenticated;

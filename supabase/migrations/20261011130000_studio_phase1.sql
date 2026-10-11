-- Digitorium Studio, phase 1: team access, leads inbox, media library.
--
-- Everything here is additive. Visitors keep exactly the access they had:
-- insert-only on leads and client_questionnaires, read-only public files.
-- Studio users are signed-in Supabase Auth users whose confirmed email is
-- listed in studio_members; their role decides what RLS lets them do.

-- ---------------------------------------------------------------- members

create table public.studio_members (
  email      text primary key check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role       text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  name       text check (char_length(name) <= 80),
  invited_by text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);
comment on table public.studio_members is 'Who can sign in to Digitorium Studio, and with which role.';
alter table public.studio_members enable row level security;

-- Role of the signed-in user, or null for anyone who is not a member.
-- Only a confirmed email counts, so an unconfirmed sign-up cannot claim a
-- member's address.
create function public.studio_role() returns text
language sql stable security definer set search_path = '' as $$
  select m.role
  from public.studio_members m
  join auth.users u on lower(u.email) = m.email
  where u.id = auth.uid() and u.email_confirmed_at is not null
$$;
revoke all on function public.studio_role() from public, anon;
grant execute on function public.studio_role() to authenticated;

create function public.studio_email() returns text
language sql stable as $$ select lower(auth.jwt() ->> 'email') $$;

grant select, insert, update, delete on public.studio_members to authenticated;

create policy "members see the team" on public.studio_members
  for select to authenticated using (public.studio_role() is not null);
create policy "owners add members" on public.studio_members
  for insert to authenticated with check (public.studio_role() = 'owner');
create policy "owners change members" on public.studio_members
  for update to authenticated using (public.studio_role() = 'owner') with check (public.studio_role() = 'owner');
create policy "owners remove members" on public.studio_members
  for delete to authenticated using (public.studio_role() = 'owner');

-- Members may stamp their own last_seen_at (and nothing else) on sign-in.
create function public.studio_touch() returns void
language sql security definer set search_path = '' as $$
  update public.studio_members set last_seen_at = now()
  where email = lower(auth.jwt() ->> 'email') and public.studio_role() is not null
$$;
revoke all on function public.studio_touch() from public, anon;
grant execute on function public.studio_touch() to authenticated;

-- The team can never be left without an owner.
create function public.studio_keep_an_owner() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and not exists (select 1 from public.studio_members where role = 'owner' and email <> old.email) then
    raise exception 'The Studio needs at least one owner.';
  end if;
  return coalesce(new, old);
end $$;
create trigger studio_keep_an_owner before update or delete on public.studio_members
  for each row execute function public.studio_keep_an_owner();

insert into public.studio_members (email, role, name, invited_by)
values ('officialdigitorium@gmail.com', 'owner', 'Digitorium', 'setup');

-- ---------------------------------------------------------------- leads

alter table public.leads
  add column status text not null default 'new' check (status in ('new', 'contacted', 'won', 'lost')),
  add column notes text check (char_length(notes) <= 4000),
  add column updated_at timestamptz,
  add column updated_by text;

alter table public.client_questionnaires
  add column status text not null default 'new' check (status in ('new', 'contacted', 'won', 'lost')),
  add column notes text check (char_length(notes) <= 4000),
  add column updated_at timestamptz,
  add column updated_by text;

-- Visitors still only insert. Signed-in members read and triage.
grant select, delete on public.leads, public.client_questionnaires to authenticated;
grant update (status, notes, updated_at, updated_by) on public.leads, public.client_questionnaires to authenticated;

create policy "studio reads leads" on public.leads
  for select to authenticated using (public.studio_role() in ('owner', 'admin', 'viewer'));
create policy "studio updates leads" on public.leads
  for update to authenticated using (public.studio_role() in ('owner', 'admin')) with check (public.studio_role() in ('owner', 'admin'));
create policy "studio deletes leads" on public.leads
  for delete to authenticated using (public.studio_role() in ('owner', 'admin'));

create policy "studio reads questionnaires" on public.client_questionnaires
  for select to authenticated using (public.studio_role() in ('owner', 'admin', 'viewer'));
create policy "studio updates questionnaires" on public.client_questionnaires
  for update to authenticated using (public.studio_role() in ('owner', 'admin')) with check (public.studio_role() in ('owner', 'admin'));
create policy "studio deletes questionnaires" on public.client_questionnaires
  for delete to authenticated using (public.studio_role() in ('owner', 'admin'));

-- New leads appear in an open Studio without a refresh (Realtime respects RLS).
alter publication supabase_realtime add table public.leads, public.client_questionnaires;

-- ---------------------------------------------------------------- activity log

create table public.studio_activity (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  actor   text not null default lower(auth.jwt() ->> 'email'),
  action  text not null check (char_length(action) between 1 and 40),
  target  text check (char_length(target) <= 300),
  details jsonb
);
alter table public.studio_activity enable row level security;
grant select, insert on public.studio_activity to authenticated;
grant usage on sequence public.studio_activity_id_seq to authenticated;

create policy "members log their own actions" on public.studio_activity
  for insert to authenticated
  with check (public.studio_role() is not null and actor = lower(auth.jwt() ->> 'email'));
create policy "owners and admins read the log" on public.studio_activity
  for select to authenticated using (public.studio_role() in ('owner', 'admin'));

-- ---------------------------------------------------------------- media

-- The site reads videos/<client>/<section>/<file>. Deleting from the Studio
-- moves a file to videos/_bin/... first, so keep the bin off the site.
create or replace function public.list_site_media()
returns table(name text, mimetype text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select o.name, o.metadata->>'mimetype', o.created_at
  from storage.objects o
  where o.bucket_id = 'videos'
    and o.name not like '%.emptyFolderPlaceholder'
    and o.name not like '\_bin/%'
  order by o.name;
$$;

create policy "studio lists media" on storage.objects
  for select to authenticated
  using (bucket_id in ('videos', 'media') and public.studio_role() is not null);
create policy "studio uploads media" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('videos', 'media') and public.studio_role() in ('owner', 'admin', 'editor'));
create policy "studio moves media" on storage.objects
  for update to authenticated
  using (bucket_id in ('videos', 'media') and public.studio_role() in ('owner', 'admin', 'editor'))
  with check (bucket_id in ('videos', 'media') and public.studio_role() in ('owner', 'admin', 'editor'));
create policy "studio deletes media" on storage.objects
  for delete to authenticated
  using (bucket_id in ('videos', 'media') and public.studio_role() in ('owner', 'admin'));

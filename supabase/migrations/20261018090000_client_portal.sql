-- Client logins: people from a client business who sign in to the Studio
-- (on their own address, e.g. cms.diptienterprise.com) and edit only their
-- own website's content. They are not in studio_members, so studio_role()
-- is null for them and every agency table (leads, questionnaires, team,
-- site_content, posts, media) stays closed to them.

create table public.client_members (
  email text primary key check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  client text not null check (client ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text check (char_length(name) <= 80),
  invited_by text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);
comment on table public.client_members is 'Client logins for the Studio. client is the site they may edit, e.g. dipti-enterprise.';
alter table public.client_members enable row level security;

-- The client the signed-in person belongs to (confirmed email only).
-- Agency staff are never treated as a client, even if listed in both.
create or replace function public.client_of()
returns text
language sql stable security definer
set search_path to ''
as $$
  select m.client
  from public.client_members m
  join auth.users u on lower(u.email) = m.email
  where u.id = auth.uid()
    and u.email_confirmed_at is not null
    and not exists (select 1 from public.studio_members s where s.email = m.email)
$$;

-- Who may edit a client's site: agency owner/admin/editor, or that client's own logins.
create or replace function public.client_can_edit(p_client text)
returns boolean
language sql stable security definer
set search_path to ''
as $$
  select coalesce(public.studio_role() in ('owner', 'admin', 'editor'), false)
      or coalesce(public.client_of() = p_client, false)
$$;

create or replace function public.client_touch()
returns void
language sql security definer
set search_path to ''
as $$
  update public.client_members set last_seen_at = now()
  where email = lower(auth.jwt() ->> 'email') and public.client_of() is not null
$$;

revoke all on function public.client_of(), public.client_can_edit(text), public.client_touch() from public, anon;
grant execute on function public.client_of(), public.client_can_edit(text), public.client_touch() to authenticated;

revoke all on public.client_members from anon, authenticated;
grant select, insert, update, delete on public.client_members to authenticated;
create policy "people see their own client login, staff see all" on public.client_members
  for select to authenticated
  using (email = lower(auth.jwt() ->> 'email') or public.studio_role() is not null);
create policy "owners and admins add client logins" on public.client_members
  for insert to authenticated with check (public.studio_role() in ('owner', 'admin'));
create policy "owners and admins change client logins" on public.client_members
  for update to authenticated
  using (public.studio_role() in ('owner', 'admin'))
  with check (public.studio_role() in ('owner', 'admin'));
create policy "owners and admins remove client logins" on public.client_members
  for delete to authenticated using (public.studio_role() in ('owner', 'admin'));

-- Dipti Enterprise tables: let Dipti's own logins edit them too.
-- (alter rather than drop and recreate, so the tables are never without a policy)
do $$
declare t text;
begin
  foreach t in array array['de_content', 'de_categories', 'de_products', 'de_reviews', 'de_gallery'] loop
    execute format($p$alter policy "studio writers add" on public.%I with check (public.client_can_edit('dipti-enterprise'))$p$, t);
    execute format('alter policy "studio writers add" on public.%I rename to "dipti editors add"', t);
    execute format($p$alter policy "studio writers edit" on public.%I using (public.client_can_edit('dipti-enterprise')) with check (public.client_can_edit('dipti-enterprise'))$p$, t);
    execute format('alter policy "studio writers edit" on public.%I rename to "dipti editors edit"', t);
    execute format($p$alter policy "studio owners and admins delete" on public.%I using (public.studio_role() in ('owner', 'admin') or public.client_of() = 'dipti-enterprise')$p$, t);
    execute format('alter policy "studio owners and admins delete" on public.%I rename to "dipti owners delete"', t);
  end loop;
  foreach t in array array['de_categories', 'de_products', 'de_reviews', 'de_gallery'] loop
    execute format($p$alter policy "members read all" on public.%I using (active or public.studio_role() is not null or public.client_of() = 'dipti-enterprise')$p$, t);
  end loop;
end $$;

-- New products added in the Studio get ids above the old WordPress ones.
create sequence public.de_products_id_seq start with 100000 owned by public.de_products.id;
alter table public.de_products alter column id set default nextval('public.de_products_id_seq');
grant usage on sequence public.de_products_id_seq to authenticated;

-- Photos clients upload: client-media/<client>/<section>/<file>, public to read.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-media', 'client-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

create policy "client editors list their media" on storage.objects
  for select to authenticated
  using (bucket_id = 'client-media' and public.client_can_edit((storage.foldername(name))[1]));
create policy "client editors upload their media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'client-media' and public.client_can_edit((storage.foldername(name))[1]));
create policy "client editors change their media" on storage.objects
  for update to authenticated
  using (bucket_id = 'client-media' and public.client_can_edit((storage.foldername(name))[1]))
  with check (bucket_id = 'client-media' and public.client_can_edit((storage.foldername(name))[1]));
create policy "client editors delete their media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'client-media' and public.client_can_edit((storage.foldername(name))[1]));

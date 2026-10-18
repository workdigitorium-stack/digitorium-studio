-- Dipti Enterprise (diptienterprise.com) content, managed from Digitorium Studio.
-- Tables are prefixed de_ (like the re_ showcase tables) so nothing here touches
-- digitorium.in content. Visitors can only read active rows. Studio members
-- edit them: owner, admin and editor can add and change, owner and admin delete.

create table public.de_content (
  key text primary key check (key ~ '^[a-z0-9-]{1,40}$'),
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 262144),
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.de_content is 'Dipti Enterprise site settings and page copy. key "site" holds contact, WhatsApp, nav, page text and SEO defaults.';

create table public.de_categories (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  old_slug text,
  sort integer not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.de_categories is 'Dipti Enterprise product categories (filter tabs and menu).';

create table public.de_products (
  id bigint primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  name text not null check (char_length(name) between 1 and 160),
  model text check (model is null or char_length(model) <= 60),
  category text not null references public.de_categories (slug) on update cascade,
  price_inr integer check (price_inr is null or price_inr >= 0),
  short_description text not null default '' check (char_length(short_description) <= 1000),
  description_html text not null default '' check (char_length(description_html) <= 50000),
  images jsonb not null default '[]' check (jsonb_typeof(images) = 'array'),
  old_url text,
  featured boolean not null default false,
  sort integer not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.de_products is 'Dipti Enterprise products. price_inr null shows "Price on request". images: [{src,width,height,alt}].';
create index de_products_category_idx on public.de_products (category, sort);

create table public.de_reviews (
  id uuid primary key default gen_random_uuid(),
  sort integer not null default 0,
  active boolean not null default true,
  name text not null check (char_length(name) between 1 and 120),
  rating numeric(2, 1) not null default 5 check (rating between 1 and 5),
  text text not null default '' check (char_length(text) <= 2000),
  date date,
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.de_reviews is 'Dipti Enterprise Google reviews shown on the site.';

create table public.de_gallery (
  id uuid primary key default gen_random_uuid(),
  sort integer not null default 0,
  active boolean not null default true,
  src text not null,
  width integer not null default 1400 check (width > 0),
  height integer not null default 1400 check (height > 0),
  alt text check (alt is null or char_length(alt) <= 200),
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.de_gallery is 'Dipti Enterprise gallery page photos.';

create or replace function public.de_stamp()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  new.updated_at := now();
  new.updated_by := lower(auth.jwt() ->> 'email');
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['de_content', 'de_categories', 'de_products', 'de_reviews', 'de_gallery'] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.de_stamp()', t || '_stamp', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format($p$create policy "studio writers add" on public.%I for insert to authenticated
      with check (public.studio_role() = any (array['owner', 'admin', 'editor']))$p$, t);
    execute format($p$create policy "studio writers edit" on public.%I for update to authenticated
      using (public.studio_role() = any (array['owner', 'admin', 'editor']))
      with check (public.studio_role() = any (array['owner', 'admin', 'editor']))$p$, t);
    execute format($p$create policy "studio owners and admins delete" on public.%I for delete to authenticated
      using (public.studio_role() = any (array['owner', 'admin']))$p$, t);
  end loop;
end $$;

-- Reads: visitors see active rows, Studio members see everything.
-- Separate anon and authenticated policies, because anon may not execute studio_role().
create policy "public reads content" on public.de_content for select to anon, authenticated using (true);
do $$
declare t text;
begin
  foreach t in array array['de_categories', 'de_products', 'de_reviews', 'de_gallery'] loop
    execute format('create policy "visitors read active" on public.%I for select to anon using (active)', t);
    execute format('create policy "members read all" on public.%I for select to authenticated using (active or public.studio_role() is not null)', t);
  end loop;
end $$;

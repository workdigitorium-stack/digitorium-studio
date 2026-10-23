-- Digitorium Studio, phase 2: editable site content (Brand + Home first).
--
-- One row per document ("brand", "home"). Each holds the draft the Studio
-- edits and the version the live site shows. Publish copies the draft to
-- published and keeps a copy in site_content_versions, so any earlier
-- version can be put back. The site reads published text only, through
-- site_content_published(); a draft is visible only to signed-in members,
-- which is how Preview works.
--
-- Who can do what (the Studio's lib/roles.js shows the same rules):
--   edit the Home draft      owner, admin, editor
--   edit the Brand draft     owner, admin
--   publish, restore         owner, admin
--   read drafts and history  any member

-- ---------------------------------------------------------------- content

create table public.site_content (
  key              text primary key check (key ~ '^[a-z0-9-]{1,40}$'),
  draft            jsonb not null check (jsonb_typeof(draft) = 'object' and pg_column_size(draft) < 262144),
  published        jsonb,
  draft_updated_at timestamptz not null default now(),
  draft_updated_by text,
  published_at     timestamptz,
  published_by     text
);
comment on table public.site_content is 'Editable text for digitorium.in. draft is what the Studio edits; published is what the site shows.';
alter table public.site_content enable row level security;

-- Supabase grants every new table to anon and authenticated by default.
-- Take that back: members read, and may change only the draft column.
-- Publishing goes through publish_site_content() below.
revoke all on public.site_content from anon, authenticated;
grant select on public.site_content to authenticated;
grant update (draft) on public.site_content to authenticated;

create policy "members read site content" on public.site_content
  for select to authenticated using (public.studio_role() is not null);
create policy "members edit drafts" on public.site_content
  for update to authenticated
  using (public.studio_role() in ('owner', 'admin') or (public.studio_role() = 'editor' and key <> 'brand'))
  with check (public.studio_role() in ('owner', 'admin') or (public.studio_role() = 'editor' and key <> 'brand'));

-- Who saved the draft and when, set by the database rather than the browser.
create function public.site_content_stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.draft is distinct from old.draft then
    new.draft_updated_at := now();
    new.draft_updated_by := lower(auth.jwt() ->> 'email');
  end if;
  return new;
end;
$$;
revoke all on function public.site_content_stamp() from public, anon, authenticated;
create trigger site_content_stamp before update on public.site_content
  for each row execute function public.site_content_stamp();

-- ---------------------------------------------------------------- versions

create table public.site_content_versions (
  id           bigint generated always as identity primary key,
  key          text not null references public.site_content (key) on delete cascade,
  content      jsonb not null,
  published_at timestamptz not null default now(),
  published_by text,
  note         text check (char_length(note) <= 200)
);
create index site_content_versions_key_at on public.site_content_versions (key, published_at desc);
alter table public.site_content_versions enable row level security;
revoke all on public.site_content_versions from anon, authenticated;
grant select on public.site_content_versions to authenticated;
create policy "members read history" on public.site_content_versions
  for select to authenticated using (public.studio_role() is not null);

-- ---------------------------------------------------------------- publish, restore

create function public.publish_site_content(p_key text) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  who text := lower(auth.jwt() ->> 'email');
  doc jsonb;
begin
  if coalesce(public.studio_role(), '') not in ('owner', 'admin') then
    raise exception 'Only an owner or admin can publish.' using errcode = '42501';
  end if;
  update public.site_content
     set published = draft, published_at = now(), published_by = who
   where key = p_key
  returning draft into doc;
  if not found then
    raise exception 'Unknown content: %', p_key using errcode = 'P0002';
  end if;
  insert into public.site_content_versions (key, content, published_by) values (p_key, doc, who);
  return now();
end;
$$;

-- Puts an earlier version back: it becomes both the draft and the live text.
create function public.restore_site_content(p_version bigint) returns text
language plpgsql security definer set search_path = '' as $$
declare
  who text := lower(auth.jwt() ->> 'email');
  v public.site_content_versions;
begin
  if coalesce(public.studio_role(), '') not in ('owner', 'admin') then
    raise exception 'Only an owner or admin can restore a version.' using errcode = '42501';
  end if;
  select * into v from public.site_content_versions where id = p_version;
  if not found then
    raise exception 'That version no longer exists.' using errcode = 'P0002';
  end if;
  update public.site_content
     set draft = v.content, published = v.content, published_at = now(), published_by = who
   where key = v.key;
  insert into public.site_content_versions (key, content, published_by, note)
  values (v.key, v.content, who, 'Restored the version from ' || to_char(v.published_at at time zone 'Asia/Kolkata', 'DD Mon YYYY, HH24:MI'));
  return v.key;
end;
$$;

revoke all on function public.publish_site_content(text) from public, anon;
revoke all on function public.restore_site_content(bigint) from public, anon;
grant execute on function public.publish_site_content(text) to authenticated;
grant execute on function public.restore_site_content(bigint) to authenticated;

-- ---------------------------------------------------------------- for the site

-- What digitorium.in reads: published text only, never drafts.
create function public.site_content_published()
returns table(key text, content jsonb)
language sql stable security definer set search_path = '' as $$
  select c.key, c.published from public.site_content c where c.published is not null;
$$;
revoke all on function public.site_content_published() from public;
grant execute on function public.site_content_published() to anon, authenticated;

-- ---------------------------------------------------------------- starting text

-- Exactly what the site shows today (app/content/defaults.json in the
-- website repo), so publishing before any edit changes nothing.
insert into public.site_content (key, draft) values
  ('brand', $seed${"logo":"https://piqzapryetvfwonreova.supabase.co/storage/v1/object/public/media/logo.png","tagline":"A digital agency in Ahmedabad. Websites, custom software, ads, SEO, shoots and branding, done in-house.","cta_label":"Start a project","header_cta_url":"https://wa.link/3vd2b1","whatsapp_url":"https://wa.me/917861982524","whatsapp_label":"Message us on WhatsApp","phone":"+917861982524","phone_display":"+91 786 198 2524","email":"info@digitorium.in","company_line":"Digitorium, a sole proprietorship of Neel Surti.","address":"10 Mangalmay Complex, Maninagar, Ahmedabad, Gujarat 380008.","menu_services":[{"icon":"web","title":"Web Design & Development","blurb":"Sites that turn a visitor into an inquiry","href":"/services/web-design-development/"},{"icon":"software","title":"Custom Software","blurb":"POS, billing and portals built around your workflow","href":"/services/custom-software/"},{"icon":"ads","title":"Meta & Google Ads","blurb":"Campaigns, creative and lead capture as one system","href":"/services/ads/"},{"icon":"seo","title":"SEO","blurb":"Local first, structure and content that ranks","href":"/services/seo/"},{"icon":"shoots","title":"Photo & Video Shoots","blurb":"Product, interior and campaign, shot in-house","href":"/services/shoots/"},{"icon":"branding","title":"Branding & Design","blurb":"Identity, packaging and the system that holds it","href":"/services/branding/"}],"menu_work":[{"title":"Devi Logistics","blurb":"Quotes, invoices and B/L from a phone","href":"/work-devi-logistics/","image":"https://piqzapryetvfwonreova.supabase.co/storage/v1/object/public/media/devi-logistics-thumb.png"},{"title":"Classic Exclusive POS","blurb":"Fabric and tailoring on one bill","href":"/work-classic-exclusive-pos/","image":"https://piqzapryetvfwonreova.supabase.co/storage/v1/object/public/media/classic-exclusive-pos-thumb.png"},{"title":"Highmark Realty","blurb":"5,000+ leads and 1,000+ clients, from zero","href":"/work-highmark-realty/","image":"https://piqzapryetvfwonreova.supabase.co/storage/v1/object/public/media/highmark-realty-thumb.png"},{"title":"Naarie","blurb":"Instagram DMs turned into WhatsApp bookings","href":"/work-naarie/","image":"https://piqzapryetvfwonreova.supabase.co/storage/v1/object/public/media/naarie-thumb.jpg"},{"title":"Riddhi Makeup Studio (Coming Soon)","blurb":"Website, social and campaigns","href":"/work/riddhi-makeup-studio/","image":"https://piqzapryetvfwonreova.supabase.co/storage/v1/object/public/media/riddhi-makeup-studio-thumb.png"},{"title":"SVJ ArchInterió","blurb":"Five years, a studio of 2 grown past 10","href":"/work-svj-archinterio/","image":"https://piqzapryetvfwonreova.supabase.co/storage/v1/object/public/media/svj-archinterio-thumb.png"},{"title":"Sociafi Media","blurb":"Online ticketing across four cities","href":"/work-sociafi-media/","image":"https://piqzapryetvfwonreova.supabase.co/storage/v1/object/public/media/sociafi-media-thumb.png"}],"footer_columns":[{"heading":"Services","links":[{"label":"Web design and development","href":"/services/web-design-development/"},{"label":"Custom software","href":"/services/custom-software/"},{"label":"Meta and Google ads","href":"/services/ads/"},{"label":"SEO","href":"/services/seo/"},{"label":"Photo and video shoots","href":"/services/shoots/"},{"label":"Branding and design","href":"/services/branding/"}]},{"heading":"Work","links":[{"label":"Highmark Realty","href":"/work-highmark-realty/"},{"label":"Devi Logistics Canada","href":"/work-devi-logistics/"},{"label":"Classic Exclusive POS","href":"/work-classic-exclusive-pos/"},{"label":"SVJ ArchInterió","href":"/work-svj-archinterio/"},{"label":"Naarie","href":"/work-naarie/"},{"label":"Sociafi Media","href":"/work-sociafi-media/"},{"label":"See all work","href":"/work/"}]},{"heading":"Industries","links":[{"label":"Real estate","href":"/work-highmark-realty/"},{"label":"Interior and architecture","href":"/work-svj-archinterio/"},{"label":"Beauty and bridal","href":"/work-naarie/"},{"label":"Events","href":"/work-sociafi-media/"},{"label":"Retail and fashion","href":"/work-classic-exclusive-pos/"},{"label":"Logistics","href":"/work-devi-logistics/"}]},{"heading":"Company","links":[{"label":"About","href":"/about/"},{"label":"Contact","href":"/contact/"},{"label":"Instagram","href":"https://www.instagram.com/digitorium.in/"}]}]}$seed$::jsonb),
  ('home', $seed${"hero":{"headline":"Websites, ads and software, backed by","words":["proof.","receipts.","results.","numbers."],"lede":"Every reel below is our own shoot, for a real client.","cta_label":"Start a project","cta2_label":"See our work","cta2_href":"/work/"},"clients":{"hidden":false,"label":"Some of the businesses we have worked with","items":[{"name":"Highmark Realty","logo":"https://piqzapryetvfwonreova.supabase.co/storage/v1/object/public/media/clients/highmark-realty.png","href":"/work-highmark-realty/"},{"name":"Devi Logistics","logo":"https://piqzapryetvfwonreova.supabase.co/storage/v1/object/public/media/clients/devi-logistics.png","href":"/work-devi-logistics/"},{"name":"Classic Exclusive","logo":"https://piqzapryetvfwonreova.supabase.co/storage/v1/object/public/media/clients/classic-exclusive.png","href":"/work-classic-exclusive-pos/"},{"name":"SVJ ArchInterió","logo":"https://piqzapryetvfwonreova.supabase.co/storage/v1/object/public/media/clients/svj-archinterio.png","href":"/work-svj-archinterio/"},{"name":"Naarie","logo":"https://piqzapryetvfwonreova.supabase.co/storage/v1/object/public/media/clients/naarie.png","href":"/work-naarie/"},{"name":"Sociafi Media","logo":"https://piqzapryetvfwonreova.supabase.co/storage/v1/object/public/media/clients/sociafi-media.png","href":"/work-sociafi-media/"},{"name":"Riddhi Makeup Studio","logo":"https://piqzapryetvfwonreova.supabase.co/storage/v1/object/public/media/clients/riddhi-makeup-studio.png","href":""}]},"services":{"hidden":false,"eyebrow":"What we do","heading":"Built for businesses that need to move fast","cta_label":"Start a project","go_label":"Explore the service","cards":[{"id":"web","title":"Web design and development","text":"Sites built to turn a visitor into an inquiry, not just to look good."},{"id":"software","title":"Custom software","text":"Billing, POS, tailoring and logistics systems built around how your business runs."},{"id":"ads","title":"Meta and Google ads","text":"Strategy, creative and lead capture as one system, qualified at the form."},{"id":"seo","title":"SEO","text":"Local first, structural second."},{"id":"shoots","title":"Photo and video shoots","text":"Product, interior and campaign, filmed and edited in-house."},{"id":"branding","title":"Branding and design","text":"Logo, identity, packaging and the system that keeps a company looking like one company."}]},"work":{"hidden":false,"eyebrow":"Selected work","heading":"Less pitch. More proof.","lead":"Every case study starts with what was broken, and ends with what changed. Names, screenshots and numbers included.","read_label":"Read case study","soon_label":"Case study in progress","all_label":"See all work","all_href":"/work/","cards":[{"tag":"Real estate · Ahmedabad","title":"Highmark Realty","text":"Meta ads and lead generation for a channel partner that started with nothing online.","href":"/work-highmark-realty/","image":"https://piqzapryetvfwonreova.supabase.co/storage/v1/object/public/media/highmark-realty-thumb.png","alt":"Highmark Realty case study","soon":false},{"tag":"Custom software · Logistics","title":"Devi Logistics Canada","text":"Quotations, invoices and bills of lading created and sent from a phone instead of Excel.","href":"/work-devi-logistics/","image":"https://piqzapryetvfwonreova.supabase.co/storage/v1/object/public/media/devi-logistics-thumb.png","alt":"Devi Logistics Canada case study","soon":false},{"tag":"Custom software · Retail","title":"Classic Exclusive POS","text":"Billing, measurements, tailoring pipeline and stock in one system built for a fabric shop.","href":"/work-classic-exclusive-pos/","image":"https://piqzapryetvfwonreova.supabase.co/storage/v1/object/public/media/classic-exclusive-pos-thumb.png","alt":"Classic Exclusive POS case study","soon":false},{"tag":"Interior design · Ahmedabad","title":"SVJ ArchInterió","text":"Five years of Meta ads and lead funnels for a studio that grew from two people to more than ten.","href":"/work-svj-archinterio/","image":"https://piqzapryetvfwonreova.supabase.co/storage/v1/object/public/media/svj-archinterio-thumb.png","alt":"SVJ ArchInterio case study","soon":false},{"tag":"Bridal makeup · Ahmedabad","title":"Naarie by Nayna Surti","text":"An Instagram-only practice turned into a website that takes bookings on WhatsApp.","href":"/work-naarie/","image":"https://piqzapryetvfwonreova.supabase.co/storage/v1/object/public/media/naarie-thumb.jpg","alt":"Naarie by Nayna Surti case study","soon":false},{"tag":"Events · International","title":"Sociafi Media","text":"A redesign with online ticketing, event galleries and automated updates for attendees.","href":"/work-sociafi-media/","image":"https://piqzapryetvfwonreova.supabase.co/storage/v1/object/public/media/sociafi-media-thumb.png","alt":"Sociafi Media case study","soon":false},{"tag":"Makeup studio · Ahmedabad","title":"Riddhi Makeup Studio","text":"Website, social media and campaigns for a makeup studio in Ahmedabad.","href":"","image":"https://piqzapryetvfwonreova.supabase.co/storage/v1/object/public/media/riddhi-makeup-studio-thumb.png","alt":"Riddhi Makeup Studio","soon":true}]},"steps":{"hidden":false,"eyebrow":"How we work","heading":"Three steps, in this order","lead":"Most agencies start at step three. That is why the reporting looks fine and the phone still does not ring.","items":[{"id":"find","title":"Find what is leaking","text":"We look at your site, your ad account and where inquiries actually go. Usually the problem is not the budget."},{"id":"fix","title":"Fix the path to an inquiry","text":"Page structure, offer, form and follow-up first. A campaign on top of a broken path just spends faster."},{"id":"run","title":"Run it and report plainly","text":"Ads, content and SEO on a schedule, with numbers you can check yourself instead of a slide deck."}]},"industries":{"hidden":false,"eyebrow":"Industries","heading":"Where we already know the ground","lead":"These six have a case study behind them. We work outside this list too, it just takes longer to learn your market.","items":[{"label":"Real estate","client":"Highmark Realty","image":"https://piqzapryetvfwonreova.supabase.co/storage/v1/object/public/media/highmark-realty-thumb.png","href":"/work-highmark-realty/"},{"label":"Interior and architecture","client":"SVJ ArchInterió","image":"https://piqzapryetvfwonreova.supabase.co/storage/v1/object/public/media/svj-archinterio-thumb.png","href":"/work-svj-archinterio/"},{"label":"Beauty and bridal","client":"Naarie","image":"https://piqzapryetvfwonreova.supabase.co/storage/v1/object/public/media/naarie-thumb.jpg","href":"/work-naarie/"},{"label":"Events","client":"Sociafi Media","image":"https://piqzapryetvfwonreova.supabase.co/storage/v1/object/public/media/sociafi-media-thumb.png","href":"/work-sociafi-media/"},{"label":"Retail and fashion","client":"Classic Exclusive","image":"https://piqzapryetvfwonreova.supabase.co/storage/v1/object/public/media/classic-exclusive-pos-thumb.png","href":"/work-classic-exclusive-pos/"},{"label":"Logistics","client":"Devi Logistics","image":"https://piqzapryetvfwonreova.supabase.co/storage/v1/object/public/media/devi-logistics-thumb.png","href":"/work-devi-logistics/"}]},"reels":{"hidden":false,"eyebrow":"Shoots and reels","heading":"The camera side of the work","lead":"Shot, cut and graded in-house. No stock footage standing in for your product.","label":"Reels","link_label":"Photo and video shoots","link_href":"/services/shoots/","note":"All work produced in-house by Digitorium. Published with client permission."},"faq":{"hidden":false,"eyebrow":"Before you ask","heading":"The questions we get every week","items":[{"q":"What does a website cost?","a":"It depends on how many pages you need and whether anything has to be built rather than designed. We quote after one call, in writing, with the scope listed. No package pages, because the packages never match what a business actually needs."},{"q":"Do you work with businesses outside Ahmedabad?","a":"Yes. We are based in Ahmedabad and have worked with clients in Canada, the Congo and elsewhere. Most of it runs over calls and WhatsApp. Shoots need us on location."},{"q":"How long before ads start bringing leads?","a":"Usually within the first week, but the first two to three weeks are spent finding which audience and creative actually work. Anyone promising results on day one is guessing."},{"q":"Can you fix a site someone else built?","a":"Often, yes. Send us the link. If the build is too tangled to be worth repairing we will say so instead of billing you to patch it."},{"q":"Do you build custom software, or only websites?","a":"Both. We have built a POS and tailoring system for a retail shop and a freight portal with quotations, invoicing and bills of lading for a logistics company. Both are case studies above."},{"q":"What do you need from us to start?","a":"Access to whatever exists already, your site, ad account and page. Then one call to hear what is not working. We will point out where the money is leaking before you pay anything."}]},"cta":{"eyebrow":"Ahmedabad, working worldwide","heading":"Show us what is not working","text":"Send us your site or your ad account. We will tell you where the money is leaking, before you pay us anything.","button_label":"Message us on WhatsApp","endnote":"Digitorium, Ahmedabad."}}$seed$::jsonb);

update public.site_content set published = draft, published_at = now(), published_by = 'setup', draft_updated_by = 'setup'
 where key in ('brand', 'home');

insert into public.site_content_versions (key, content, published_by, note)
select key, published, 'setup', 'Text the site had before the Studio' from public.site_content;

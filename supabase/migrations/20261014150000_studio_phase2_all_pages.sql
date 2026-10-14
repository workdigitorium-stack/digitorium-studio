-- Digitorium Studio, phase 2 continued: every other page of the site.
--
-- These pages keep their text in the website's code. Each document here
-- holds only what the Studio changed, as { "<field id>": "new text" }; a
-- field that is not in it shows the original from the code. The field ids
-- and labels are listed in the Studio's lib/site-pages.json (written by
-- scripts/content-slots.js in the website repo). Empty means "as built".

insert into public.site_content (key, draft, published, published_at, published_by, draft_updated_by)
select k, '{}'::jsonb, '{}'::jsonb, now(), 'setup', 'setup'
from unnest(array[
  'services', 'service-web-design-development', 'service-custom-software', 'service-ads', 'service-seo',
  'service-shoots', 'service-branding', 'service-shared',
  'work', 'work-highmark-realty', 'work-devi-logistics', 'work-classic-exclusive-pos', 'work-svj-archinterio',
  'work-naarie', 'work-sociafi-media',
  'about', 'contact', 'privacy-policy', 'terms-and-conditions'
]) as k
on conflict (key) do nothing;

insert into public.site_content_versions (key, content, published_by, note)
select c.key, c.published, 'setup', 'The page as built, before any edit'
from public.site_content c
where c.key not in ('brand', 'home')
  and not exists (select 1 from public.site_content_versions v where v.key = c.key);

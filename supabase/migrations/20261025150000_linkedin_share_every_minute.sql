-- Digitorium Studio: share scheduled posts on LinkedIn at their time.
--
-- Vercel's free plan runs vercel.json crons once a day, so until now a
-- scheduled post only reached LinkedIn when someone opened Posts, or at the
-- daily 10:00 run. Here the database checks every minute instead: when a
-- post ticked for LinkedIn is live and not shared yet, it calls the Studio's
-- share run (GET /api/linkedin/share, the same call Vercel's cron makes).
-- Nothing is sent on minutes when nothing is due.
--
-- It needs two Vault secrets, set once in the SQL editor:
--   select vault.create_secret('https://studio.digitorium.in', 'studio_url');
--   select vault.create_secret('<the CRON_SECRET set in Vercel>', 'studio_cron_secret');
-- Until both exist it does nothing.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create function public.linkedin_share_tick()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  url    text;
  secret text;
begin
  -- same rule as shareDue() in lib/linkedin-server.js
  if not exists (select 1 from public.linkedin_account a where a.id = 1 and a.expires_at > now()) then return; end if;
  if not exists (
    select 1 from public.posts p
    where p.published is not null
      and p.publish_at <= now()
      and p.linkedin_urn is null
      and p.linkedin_error is null
      and p.published->'linkedin'->>'share' = 'true'
      and (p.linkedin_claimed_at is null or p.linkedin_claimed_at < now() - interval '10 minutes')
  ) then return; end if;

  select decrypted_secret into url from vault.decrypted_secrets where name = 'studio_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'studio_cron_secret';
  if url is null or secret is null then return; end if;

  perform net.http_get(
    url := rtrim(url, '/') || '/api/linkedin/share',
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret),
    timeout_milliseconds := 30000
  );
end;
$$;
revoke all on function public.linkedin_share_tick() from public, anon, authenticated;

select cron.schedule('studio-linkedin-share', '* * * * *', 'select public.linkedin_share_tick()');

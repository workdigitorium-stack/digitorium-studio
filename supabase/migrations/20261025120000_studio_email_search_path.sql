-- Supabase security advisor: "Function Search Path Mutable".
-- studio_email() only calls auth.jwt(), already schema-qualified, so an
-- empty search_path changes nothing except closing the warning.
alter function public.studio_email() set search_path = '';

-- Refine the revocation function
-- 1. Remove security definer to respect RLS (safer default if RLS is set up correctly)
-- 2. Add NULL check to prevent accidental mass deletion
create or replace function revoke_other_sessions(current_session_id uuid)
returns void
language plpgsql
as $$
begin
  if current_session_id is null then
    raise exception 'current_session_id cannot be null';
  end if;

  delete from public.user_sessions
  where user_id = auth.uid()
  and id <> current_session_id;
end;
$$;

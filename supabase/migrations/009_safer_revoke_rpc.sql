-- Refine the revocation function with SAFETY CHECK
-- Ensure the current_session_id actually exists for this user before deleting anything.
-- This prevents the "suicide" scenario where a client holding a wrong/stale ID accidentally deletes their real active session (because it != stale_id).

create or replace function revoke_other_sessions(current_session_id uuid)
returns void
language plpgsql
as $$
declare
  exists_check int;
begin
  -- 1. Validate Input
  if current_session_id is null then
    raise exception 'current_session_id cannot be null';
  end if;

  -- 2. Verify we are protecting a REAL session
  select count(*) into exists_check
  from public.user_sessions
  where id = current_session_id
  and user_id = auth.uid();

  if exists_check = 0 then
    raise exception 'Current session not found. Cannot safely revoke others.';
  end if;

  -- 3. Perform Deletion
  delete from public.user_sessions
  where user_id = auth.uid()
  and id <> current_session_id;
end;
$$;

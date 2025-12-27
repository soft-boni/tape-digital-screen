-- Function to safely revoke all sessions except the current one for the authenticated user
create or replace function revoke_other_sessions(current_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.user_sessions
  where user_id = auth.uid()
  and id != current_session_id;
end;
$$;

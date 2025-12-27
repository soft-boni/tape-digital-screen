-- Enable Realtime for user_sessions so clients can listen for revocation
alter publication supabase_realtime add table user_sessions;

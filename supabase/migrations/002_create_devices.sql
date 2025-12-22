-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create devices table
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  pin TEXT,
  activated BOOLEAN DEFAULT FALSE,
  ip_address TEXT,
  screen_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  activated_at TIMESTAMP WITH TIME ZONE,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own devices" ON devices;
DROP POLICY IF EXISTS "Users can insert own devices" ON devices;
DROP POLICY IF EXISTS "Users can update own devices" ON devices;
DROP POLICY IF EXISTS "Users can delete own devices" ON devices;
DROP POLICY IF EXISTS "Service role can manage all devices" ON devices;

-- Policy: Users can read their own devices
CREATE POLICY "Users can read own devices"
  ON devices
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own devices  
CREATE POLICY "Users can insert own devices"
  ON devices
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own devices
CREATE POLICY "Users can update own devices"
  ON devices
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own devices
CREATE POLICY "Users can delete own devices"
  ON devices
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policy: Service role (backend) can manage all devices
CREATE POLICY "Service role can manage all devices"
  ON devices
  USING (auth.role() = 'service_role');

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS devices_user_id_idx ON devices(user_id);
CREATE INDEX IF NOT EXISTS devices_pin_idx ON devices(pin);
CREATE INDEX IF NOT EXISTS devices_id_idx ON devices(id);

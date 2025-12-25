-- Safe migration: handle both cases
-- First, check if screen_id exists and rename it, otherwise add program_id if it doesn't exist

DO $$
BEGIN
    -- Check if screen_id column exists and rename it
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'devices' AND column_name = 'screen_id'
    ) THEN
        ALTER TABLE devices RENAME COLUMN screen_id TO program_id;
        RAISE NOTICE 'Renamed screen_id to program_id';
    END IF;
    
    -- If program_id doesn't exist, create it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'devices' AND column_name = 'program_id'
    ) THEN
        ALTER TABLE devices ADD COLUMN program_id TEXT;
        RAISE NOTICE 'Added program_id column';
    END IF;
END $$;

-- Create programs table (safe - only if not exists)
CREATE TABLE IF NOT EXISTS programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  resolution TEXT DEFAULT '1920x1080',
  content JSONB DEFAULT '[]'::jsonb,
  background_music TEXT,
  background_music_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on programs (safe)
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (safe)
DROP POLICY IF EXISTS "Users can read own programs" ON programs;
DROP POLICY IF EXISTS "Users can insert own programs" ON programs;
DROP POLICY IF EXISTS "Users can update own programs" ON programs;
DROP POLICY IF EXISTS "Users can delete own programs" ON programs;
DROP POLICY IF EXISTS "Service role can manage all programs" ON programs;

-- Create policies
CREATE POLICY "Users can read own programs"
  ON programs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own programs"
  ON programs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own programs"
  ON programs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own programs"
  ON programs FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all programs"
  ON programs
  USING (auth.role() = 'service_role');

-- Create indexes (safe)
CREATE INDEX IF NOT EXISTS programs_user_id_idx ON programs(user_id);
CREATE INDEX IF NOT EXISTS programs_id_idx ON programs(id);

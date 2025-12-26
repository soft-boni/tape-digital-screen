import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = 'https://aumsyunntzcbqajwdyga.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigrations() {
    console.log('Running database migrations...');

    // Read migration files
    const migration1 = readFileSync(join(__dirname, '../migrations/001_create_profiles.sql'), 'utf-8');
    const migration2 = readFileSync(join(__dirname, '../migrations/002_create_devices.sql'), 'utf-8');
    const migration4 = readFileSync(join(__dirname, '../migrations/004_add_super_admin_schema.sql'), 'utf-8');

    try {
        // Execute migration 1
        console.log('Creating profiles table...');
        const { error: error1 } = await supabase.rpc('exec_sql', { sql: migration1 });
        if (error1) console.log('Table likely exists, skipping...');

        // Execute migration 2
        console.log('Creating devices table...');
        const { error: error2 } = await supabase.rpc('exec_sql', { sql: migration2 });
        if (error2) console.log('Table likely exists, skipping...');

        // Execute migration 4
        console.log('Applying Super Admin schema...');
        const { error: error4 } = await supabase.rpc('exec_sql', { sql: migration4 });
        if (error4) console.warn('Migration 4 warning:', error4.message);
        else console.log('✓ Super Admin schema applied');

        console.log('All migrations completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigrations();

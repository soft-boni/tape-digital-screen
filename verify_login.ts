
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://aumsyunntzcbqajwdyga.supabase.co";
// ANON KEY works for login
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bXN5dW5udHpjYnFhandkeWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMjQwNDgsImV4cCI6MjA4MTgwMDA0OH0.mRj__b-haEPW5PaSgAEEAob_ewPWIme89mYaPLWtyhM";

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    console.log("1. Attempting login as mdruyem@gmail.com...");
    const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
        email: 'mdruyem@gmail.com',
        password: '12345678',
    });

    if (authError) {
        console.error("❌ Login Failed:", authError.message);
        return;
    }
    console.log("✅ Login Successful! User ID:", user?.id);

    console.log("2. Attempting to fetch Profile...");
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

    if (profileError) {
        console.error("❌ Profile Fetch Failed (RLS Issue?):", profileError.message);
    } else {
        console.log("✅ Profile Found:", profile);
        if (profile.role === 'super_admin') {
            console.log("🎉 SUCCESS: Role is correct (super_admin).");
        } else {
            console.error(`❌ FAILURE: Role is '${profile.role}' (Expected 'super_admin').`);
        }
    }
}

verify();

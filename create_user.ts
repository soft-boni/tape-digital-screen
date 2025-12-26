
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://aumsyunntzcbqajwdyga.supabase.co";
// Using ANON KEY recovered earlier
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bXN5dW5udHpjYnFhandkeWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMjQwNDgsImV4cCI6MjA4MTgwMDA0OH0.mRj__b-haEPW5PaSgAEEAob_ewPWIme89mYaPLWtyhM";

const supabase = createClient(supabaseUrl, supabaseKey);

async function signUp() {
    console.log("Attempting to create user: mdruyem@gmail.com");
    const { data, error } = await supabase.auth.signUp({
        email: 'mdruyem@gmail.com',
        password: '12345678',
    });

    if (error) {
        console.error('Error creating user:', error.message);
    } else {
        console.log('User created successfully:', data.user?.id);
        console.log('Metadata:', data.user?.user_metadata);
    }
}

signUp();

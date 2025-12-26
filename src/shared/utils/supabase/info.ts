/// <reference types="vite/client" />

// Extract project ID from URL or use env var
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];

let rawId = import.meta.env.VITE_SUPABASE_PROJECT_ID || projectRef;
if (rawId === 'your-project-id') rawId = null;

export const projectId = rawId || 'aumsyunntzcbqajwdyga';
export const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bXN5dW5udHpjYnFhandkeWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMjQwNDgsImV4cCI6MjA4MTgwMDA0OH0.mRj__b-haEPW5PaSgAEEAob_ewPWIme89mYaPLWtyhM';

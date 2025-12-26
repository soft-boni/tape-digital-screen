/// <reference types="vite/client" />

// Extract project ID from URL or use env var
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];

export const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || projectRef || 'your-project-id';
export const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

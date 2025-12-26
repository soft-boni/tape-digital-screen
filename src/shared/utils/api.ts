
import { supabase } from "@/App";
import { projectId } from "@/shared/utils/supabase/info";

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-31bfbcca`;

// Get anon key for Supabase gateway
import { publicAnonKey as SUPABASE_ANON_KEY } from "@/shared/utils/supabase/info";

export async function apiFetch(path: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY, // Required by Supabase gateway
    // CRITICAL: Authorization header is REQUIRED even for public endpoints
    // Use session token if available, otherwise use anon key as Bearer token
    "Authorization": `Bearer ${token || SUPABASE_ANON_KEY}`,
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `Request failed with status ${response.status}`);
  }

  return response.json();
}

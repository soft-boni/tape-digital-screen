import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "./info";

const supabaseUrl = `https://${projectId}.supabase.co`;

console.log("[Supabase] Initializing client with:", {
    projectId,
    url: supabaseUrl,
    hasKey: !!publicAnonKey
});

export const supabase = createClient(supabaseUrl, publicAnonKey);

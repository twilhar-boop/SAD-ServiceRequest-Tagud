// ---------------------------------------------------------------
// Supabase client initialization
// ---------------------------------------------------------------
// Replace the two constants below with the values from your own
// Supabase project: Project Settings -> API.
//
// IMPORTANT SECURITY NOTE
// Only the "anon" / "publishable" key belongs here. Never paste the
// service_role key into any file that is hosted on GitHub Pages —
// that key bypasses Row Level Security entirely.
// ---------------------------------------------------------------

const SUPABASE_URL = "https://uhrckgvwtdfczositkcm.supabase.co";
const SUPABASE_KEY = "sb_publishable_rfQikp6Yb0kUVzE7ihBk5g_Aa047Wys";

// `supabase` here refers to the global created by the CDN script
// tag (@supabase/supabase-js) loaded in index.html / login.html.
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

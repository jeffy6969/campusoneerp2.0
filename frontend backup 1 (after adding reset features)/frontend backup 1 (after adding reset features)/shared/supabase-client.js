// Fill these in from: Supabase Dashboard > Project Settings > API
// SUPABASE_ANON_KEY is the public "anon" key — safe to expose in
// client-side code, since RLS policies are what actually control access.
const SUPABASE_URL = 'https://kvqstithlgzyjkngqzun.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_kgjUyXJO6XgR8NoDUPDxjA_cmi0gelS';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

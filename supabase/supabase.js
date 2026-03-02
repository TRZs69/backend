const { createClient } = require('@supabase/supabase-js');

const fallbackUrl = 'https://itarozdimxukkhwxruti.supabase.co';
const fallbackAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0YXJvemRpbXh1a2tod3hydXRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2MTQ2MzgsImV4cCI6MjA3NDE5MDYzOH0.q7y0a7wiOaKcmkvWt0-G9ZXxj4f9BdogBB_mTGREOVY';

const supabaseUrl = process.env.SUPABASE_URL || process.env.LEVELY_SUPABASE_URL || fallbackUrl;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.LEVELY_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLIC_ANON_KEY ||
  fallbackAnonKey;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

module.exports = supabase;
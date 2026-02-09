const { createClient } = require('@supabase/supabase-js');

const fallbackUrl = 'https://vvivfqnqxnpfpijrvkkb.supabase.co';
const fallbackAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2aXZmcW5xeG5wZnBpanJ2a2tiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2MTQxMjEsImV4cCI6MjA3NDE5MDEyMX0.VwNktSJnyCuvBHEEMw4hv4wsHm7wT1MxS6foqR2i4Nk';

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
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY
  process.env.LEVELY_SUPABASE_SERVICE_ROLE_KEY
  process.env.SUPABASE_ANON_KEY
  process.env.SUPABASE_PUBLIC_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

module.exports = supabase;
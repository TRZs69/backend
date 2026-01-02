const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://vvivfqnqxnpfpijrvkkb.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2aXZmcW5xeG5wZnBpanJ2a2tiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2MTQxMjEsImV4cCI6MjA3NDE5MDEyMX0.VwNktSJnyCuvBHEEMw4hv4wsHm7wT1MxS6foqR2i4Nk";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = supabase;
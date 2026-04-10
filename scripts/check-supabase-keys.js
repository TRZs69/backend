const supabase = require('../supabase/supabase.js');

console.log('🔑 Checking Supabase connection details...\n');

// Check environment variables
const envVars = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    LEVELY_SUPABASE_URL: process.env.LEVELY_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    LEVELY_SUPABASE_SERVICE_ROLE_KEY: process.env.LEVELY_SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
};

console.log('Environment variables set:');
Object.entries(envVars).forEach(([key, value]) => {
    if (value) {
        const masked = value.substring(0, 10) + '...' + value.substring(value.length - 5);
        console.log(`  ✅ ${key}: ${masked}`);
    } else {
        console.log(`  ❌ ${key}: NOT SET`);
    }
});

console.log('\n⚠️  The issue: RLS policy blocks INSERT on chat_sessions');
console.log('   Solution needed: Use Service Role key or disable RLS for chat_sessions');

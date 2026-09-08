const { createClient } = require('@supabase/supabase-js');

const url = 'https://mlddsyylbkzlrqdhonfr.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZGRzeXlsYmt6bHJxZGhvbmZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0NzEyNTgsImV4cCI6MjEwMzA0NzI1OH0.Rq5fpFEJYlK119FcbUDCkZTpIIa5EYUeDIME_-J6OBA';

const supabase = createClient(url, key);

(async () => {
  console.log('🔑 Testing Login for ModBit Labs (arun@modbitlabs.auth.leadweave)...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'arun@modbitlabs.auth.leadweave',
    password: 'Nightshade'
  });

  if (error) {
    console.error('❌ Login Error:', error.message);
  } else {
    console.log('✅ LOGIN SUCCESSFUL!');
    console.log('User ID:', data.user?.id);
    console.log('Email:', data.user?.email);
    console.log('Access Token (truncated):', data.session?.access_token.substring(0, 30) + '...');
  }
})();

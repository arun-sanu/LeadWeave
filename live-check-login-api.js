const { createClient } = require('@supabase/supabase-js');

const url = 'https://mlddsyylbkzlrqdhonfr.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZGRzeXlsYmt6bHJxZGhvbmZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0NzEyNTgsImV4cCI6MjEwMzA0NzI1OH0.Rq5fpFEJYlK119FcbUDCkZTpIIa5EYUeDIME_-J6OBA';

const supabase = createClient(url, key);

(async () => {
  console.log('================================================================');
  console.log('⚡ REALTIME SUPABASE AUTH DIAGNOSTIC CHECK');
  console.log('================================================================\n');

  console.log('🔑 Testing Auth for ModBit Labs (arun@modbitlabs.auth.leadweave)...');
  const res1 = await supabase.auth.signInWithPassword({
    email: 'arun@modbitlabs.auth.leadweave',
    password: 'Nightshade'
  });

  if (res1.error) {
    console.log(` ❌ ModBit Labs Login Failed: ${res1.error.message} (Status ${res1.error.status})`);
  } else {
    console.log(` ✅ ModBit Labs LOGIN SUCCESS! User ID: ${res1.data.user.id}`);
  }

  console.log('\n🔑 Testing Auth for LifeGrains (arun@lifegrains.auth.leadweave)...');
  const res2 = await supabase.auth.signInWithPassword({
    email: 'arun@lifegrains.auth.leadweave',
    password: 'Nightshade'
  });

  if (res2.error) {
    console.log(` ❌ LifeGrains Login Failed: ${res2.error.message} (Status ${res2.error.status})`);
  } else {
    console.log(` ✅ LifeGrains LOGIN SUCCESS! User ID: ${res2.data.user.id}`);
  }

  console.log('\n================================================================');
})();

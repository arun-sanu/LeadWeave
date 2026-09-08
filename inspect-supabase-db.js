const { createClient } = require('@supabase/supabase-js');

const url = 'https://mlddsyylbkzlrqdhonfr.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZGRzeXlsYmt6bHJxZGhvbmZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0NzEyNTgsImV4cCI6MjEwMzA0NzI1OH0.Rq5fpFEJYlK119FcbUDCkZTpIIa5EYUeDIME_-J6OBA';

const supabase = createClient(url, key);

(async () => {
  console.log('================================================================');
  console.log('⚡ SUPABASE DATABASE COMPREHENSIVE INSPECTION');
  console.log('================================================================\n');

  // 1. Check companies table count & sample rows
  const { data: companies, error: compErr } = await supabase.from('companies').select('*');
  console.log('📌 1. Table `companies`:');
  if (compErr) console.error('  ❌ Error:', compErr.message);
  else console.log(`  Count: ${companies.length} | Rows:`, JSON.stringify(companies, null, 2));

  // 2. Check profiles / users table
  const { data: profiles, error: profErr } = await supabase.from('profiles').select('*');
  console.log('\n📌 2. Table `profiles`:');
  if (profErr) console.error('  ❌ Error:', profErr.message);
  else console.log(`  Count: ${profiles.length} | Rows:`, JSON.stringify(profiles, null, 2));

  // 3. Check auth.users via RPC or public metadata if accessible
  const { data: appUsers, error: usersErr } = await supabase.from('users').select('*');
  console.log('\n📌 3. Table `users`:');
  if (usersErr) console.error('  ❌ Error/Not public:', usersErr.message);
  else console.log(`  Count: ${appUsers.length} | Rows:`, JSON.stringify(appUsers, null, 2));

  console.log('\n================================================================');
})();

const { createClient } = require('@supabase/supabase-js');

const url = 'https://mlddsyylbkzlrqdhonfr.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZGRzeXlsYmt6bHJxZGhvbmZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0NzEyNTgsImV4cCI6MjEwMzA0NzI1OH0.Rq5fpFEJYlK119FcbUDCkZTpIIa5EYUeDIME_-J6OBA';

const supabase = createClient(url, key);

(async () => {
  console.log('⚡ Creating Accounts via Official Supabase Auth API...');

  const accounts = [
    {
      email: 'arun@modbitlabs.auth.leadweave',
      password: 'Nightshade',
      fullName: 'Arun',
      companyName: 'ModBit Labs',
      role: 'superadmin'
    },
    {
      email: 'arun@lifegrains.auth.leadweave',
      password: 'Nightshade',
      fullName: 'Arun',
      companyName: 'LifeGrains',
      role: 'companyadmin'
    }
  ];

  for (const acc of accounts) {
    console.log(`\n📧 Registering: ${acc.email} (${acc.role})...`);
    const { data, error } = await supabase.auth.signUp({
      email: acc.email,
      password: acc.password,
      options: {
        data: {
          full_name: acc.fullName,
          company_name: acc.companyName,
          role: acc.role
        }
      }
    });

    if (error) {
      console.error(` ❌ Registration Result: ${error.message}`);
    } else {
      console.log(` ✅ SUCCESS! User ID: ${data.user?.id}`);
    }
  }
})();

const { createClient } = require('@supabase/supabase-js');

const url = 'https://mlddsyylbkzlrqdhonfr.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZGRzeXlsYmt6bHJxZGhvbmZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0NzEyNTgsImV4cCI6MjEwMzA0NzI1OH0.Rq5fpFEJYlK119FcbUDCkZTpIIa5EYUeDIME_-J6OBA';

const supabase = createClient(url, key);

(async () => {
  const usersToCreate = [
    {
      company: 'ModBit Labs',
      fullName: 'Arun',
      password: 'Nightshade',
      email: 'arun@modbitlabs.com',
      role: 'superadmin'
    },
    {
      company: 'LifeGrains',
      fullName: 'Arun',
      password: 'Nightshade',
      email: 'arun@lifegrains.in',
      role: 'companyadmin'
    }
  ];

  for (const u of usersToCreate) {
    console.log(`\n📧 Creating user ${u.fullName} for ${u.company} (${u.email})...`);
    const { data, error } = await supabase.auth.signUp({
      email: u.email,
      password: u.password,
      options: {
        data: {
          full_name: u.fullName,
          company_name: u.company,
          role: u.role
        }
      }
    });

    if (error) {
      console.error(` ❌ Error creating ${u.email}:`, error.message);
    } else {
      console.log(` ✅ User created successfully! User ID: ${data.user?.id}`);
    }
  }
})();

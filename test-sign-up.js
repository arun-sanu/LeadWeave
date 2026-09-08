const { createClient } = require('@supabase/supabase-js');

const url = 'https://mlddsyylbkzlrqdhonfr.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZGRzeXlsYmt6bHJxZGhvbmZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0NzEyNTgsImV4cCI6MjEwMzA0NzI1OH0.Rq5fpFEJYlK119FcbUDCkZTpIIa5EYUeDIME_-J6OBA';

const supabase = createClient(url, key);

const slugify = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

(async () => {
  const companyName = 'ModBit Labs';
  const fullName = 'Arun';
  const password = 'Nightshade';
  
  const email = `${slugify(fullName)}@${slugify(companyName)}.auth.leadweave`;
  console.log(`📧 Generated Auth Email: ${email}`);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        company_name: companyName,
        role: 'superadmin'
      }
    }
  });

  if (error) {
    console.error('❌ SignUp Error:', error.message);
  } else {
    console.log('✅ SignUp Success:', data);
  }
})();

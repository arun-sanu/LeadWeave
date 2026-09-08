const { createClient } = require('@supabase/supabase-js');

const url = 'https://mlddsyylbkzlrqdhonfr.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZGRzeXlsYmt6bHJxZGhvbmZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0NzEyNTgsImV4cCI6MjEwMzA0NzI1OH0.Rq5fpFEJYlK119FcbUDCkZTpIIa5EYUeDIME_-J6OBA';

const supabase = createClient(url, key);

(async () => {
  const { data, error } = await supabase.rpc('seed_initial_data');
  if (error) {
    console.log('RPC check:', error.message);
  } else {
    console.log('RPC result:', data);
  }
})();

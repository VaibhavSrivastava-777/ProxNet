const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key);

async function test() {
  const rpcs = ['run_sql', 'exec_sql', 'execute_sql', 'sql', 'exec'];
  for (const rpc of rpcs) {
    try {
      const { data, error } = await supabase.rpc(rpc, { sql: 'SELECT 1;' });
      console.log(`RPC ${rpc}:`, { data, error });
    } catch (e) {
      console.log(`RPC ${rpc} catch:`, e.message);
    }
  }
}

test();

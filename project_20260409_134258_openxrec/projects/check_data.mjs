import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const { data, error } = await supabase
  .from('cases')
  .select('id, key_factors, agent_outputs')
  .limit(3);

if (error) {
  console.error('Error:', error);
} else {
  data.forEach(c => {
    console.log('\n=== Case ID:', c.id, '===');
    console.log('key_factors type:', typeof c.key_factors);
    console.log('key_factors:', JSON.stringify(c.key_factors, null, 2).slice(0, 800));
    console.log('\nagent_outputs keys:', c.agent_outputs ? Object.keys(c.agent_outputs) : 'null');
    if (c.agent_outputs?.key_factor_extractor) {
      const kfe = c.agent_outputs.key_factor_extractor;
      console.log('key_factor_extractor type:', typeof kfe);
      console.log('key_factor_extractor keys:', kfe ? Object.keys(kfe) : 'null');
      console.log('key_factor_extractor sample:', JSON.stringify(kfe, null, 2).slice(0, 1000));
    }
  });
}

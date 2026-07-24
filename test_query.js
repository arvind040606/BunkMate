import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const url = "https://iqmmznvsvabmrzaupgjf.supabase.co";
const key = "sb_publishable_ejPrPSTFInDCOCvobcRsrw_SJNss7bD";

console.log('Initializing Supabase client...');
const supabase = createClient(url, key);

async function run() {
  console.log('Script run started...');
  const logLines = [];
  logLines.push('--- Checking Supabase tables ---');
  try {
    const tables = ['users', 'friends', 'subjects', 'timetable', 'attendance', 'assignments', 'exams', 'settings'];
    for (const table of tables) {
      console.log(`Querying table: ${table}...`);
      const { data, count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact' });
      if (error) {
        logLines.push(`Error on table ${table}: ${error.message} - ${error.details}`);
        console.error(`Error on table ${table}:`, error.message);
      } else {
        logLines.push(`Table: ${table} | Count: ${count} | Sample: ${JSON.stringify(data ? data.slice(0, 2) : [])}`);
        console.log(`Table: ${table} | Count: ${count}`);
      }
    }
  } catch (err) {
    logLines.push(`Error running query: ${err.message}`);
    console.error('Catch error:', err);
  }

  const outputPath = './test_results.txt';
  fs.writeFileSync(outputPath, logLines.join('\n'));
  console.log('Results written to', outputPath);
}

run().catch(console.error);

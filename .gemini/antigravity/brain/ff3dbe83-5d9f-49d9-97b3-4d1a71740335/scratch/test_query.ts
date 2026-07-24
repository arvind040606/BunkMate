import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const url = "https://iqmmznvsvabmrzaupgjf.supabase.co";
const key = "sb_publishable_ejPrPSTFInDCOCvobcRsrw_SJNss7bD";

const supabase = createClient(url, key);

async function run() {
  const logLines = [];
  logLines.push('--- Checking Supabase tables ---');
  try {
    const tables = ['users', 'friends', 'subjects', 'timetable', 'attendance', 'assignments', 'exams', 'settings'];
    for (const table of tables) {
      const { data, count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact' });
      if (error) {
        logLines.push(`Error on table ${table}: ${error.message} - ${error.details}`);
      } else {
        logLines.push(`Table: ${table} | Count: ${count} | Sample: ${JSON.stringify(data ? data.slice(0, 2) : [])}`);
      }
    }
  } catch (err: any) {
    logLines.push(`Error running query: ${err.message}`);
  }

  const outputDir = process.cwd();
  fs.writeFileSync(path.join(outputDir, 'test_results.txt'), logLines.join('\n'));
}

run();

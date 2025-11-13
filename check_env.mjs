// check_env.mjs
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

console.log('cwd =', process.cwd());
console.log('.env path =', path.join(process.cwd(), '.env'));

try {
  const raw = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
  console.log('--- .env RAW START ---');
  console.log(raw);
  console.log('--- .env RAW END ---');
} catch (e) {
  console.log('Could not read .env file:', e.message);
}

console.log('process.env.SOGNI_USERNAME =', process.env.SOGNI_USERNAME === undefined ? 'undefined' : '***SET***');
console.log('process.env.SOGNI_PASSWORD =', process.env.SOGNI_PASSWORD ? '***SET***' : '***NOT SET***');

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const localEnvPath = resolve('.env.local');
const defaultEnvPath = resolve('.env');
const requiredKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

const envPath = existsSync(localEnvPath) ? localEnvPath : defaultEnvPath;

if (!existsSync(envPath)) {
  console.error('❌ Не найден ни .env.local, ни .env');
  process.exit(1);
}

const raw = readFileSync(envPath, 'utf8');
const lines = raw
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith('#'));

const env = new Map();
for (const line of lines) {
  const eq = line.indexOf('=');
  if (eq === -1) continue;
  const key = line.slice(0, eq).trim();
  const value = line.slice(eq + 1).trim();
  env.set(key, value);
}

const missing = requiredKeys.filter((key) => !env.get(key));
if (missing.length > 0) {
  console.error('❌ В .env.local не хватает обязательных переменных Firebase:');
  for (const key of missing) console.error(` - ${key}`);
  process.exit(1);
}

console.log(`✅ Firebase env выглядит заполненным (${envPath.endsWith('.env.local') ? '.env.local' : '.env'})`);

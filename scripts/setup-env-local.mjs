import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const examplePath = resolve('.env.example');
const localPath = resolve('.env.local');

if (!existsSync(examplePath)) {
  console.error('❌ Не найден .env.example');
  process.exit(1);
}

if (existsSync(localPath)) {
  console.log('ℹ️ .env.local уже существует, ничего не меняю');
  process.exit(0);
}

copyFileSync(examplePath, localPath);
console.log('✅ Создан .env.local из .env.example');

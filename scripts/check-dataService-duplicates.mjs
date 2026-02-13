import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/services/dataService.ts', import.meta.url), 'utf8');

const checks = [
  'const getFromStorage =',
  'let queuedRemoteSnapshot',
  'let remotePushInFlight',
  'let remotePushRetryTimer',
  'let localMutationVersion',
  'const flushRemoteQueue =',
  'const syncToRemote =',
  'const setToStorage ='
];

const errors = [];
for (const marker of checks) {
  const count = source.split(marker).length - 1;
  if (count !== 1) {
    errors.push(`${marker} -> expected 1, got ${count}`);
  }
}

if (errors.length > 0) {
  console.error('Duplicate/merge corruption detected in src/services/dataService.ts');
  for (const item of errors) console.error(` - ${item}`);
  process.exit(1);
}

console.log('dataService duplicate declaration check passed');

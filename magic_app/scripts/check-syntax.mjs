import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { spawnSync } from 'child_process';

const errors = [];

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full, files);
    } else if (name.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

const files = [
  ...walk(join(process.cwd(), 'public', 'js')),
  ...walk(join(process.cwd(), 'api'))
];

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    errors.push(`${relative(process.cwd(), file)}: ${(result.stderr || result.stdout).trim()}`);
  }
}

if (errors.length) {
  console.error('Syntax errors:\n');
  errors.forEach(e => console.error(' -', e));
  process.exit(1);
}

console.log(`OK: ${files.length} files passed syntax check`);

/**
 * Генерирует lucik-run-1..4.png из SVG (прозрачный фон).
 * Требует: npm install sharp (dev)
 * Запуск: node scripts/generate-runner-sprites.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const imagesDir = join(__dirname, '../public/assets/images');

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.log('sharp не установлен — PNG не сгенерированы. Игра использует lucik-run-*.svg');
  process.exit(0);
}

for (let i = 1; i <= 4; i++) {
  const svgPath = join(imagesDir, `lucik-run-${i}.svg`);
  const pngPath = join(imagesDir, `lucik-run-${i}.png`);
  if (!existsSync(svgPath)) {
    console.warn(`Пропуск: нет ${svgPath}`);
    continue;
  }
  const svg = readFileSync(svgPath);
  await sharp(svg).resize(200, 200).png().toFile(pngPath);
  console.log(`OK: lucik-run-${i}.png`);
}

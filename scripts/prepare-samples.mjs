import { chromium } from '@playwright/test';
import { readFile, copyFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const [id, input] = process.argv.slice(2);
if (!['portrait', 'food', 'landscape', 'cafe', 'street', 'night', 'interior'].includes(id) || !input) throw new Error('Usage: node scripts/prepare-samples.mjs ID INPUT_PNG');
const bytes = await readFile(resolve(input));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const output = await page.evaluate(async (data) => {
    const image = new Image(); image.src = data; await image.decode();
    if (image.naturalWidth < 1024 || image.naturalWidth !== image.naturalHeight) throw new Error('Square master >=1024 required');
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    canvas.getContext('2d').drawImage(image, 0, 0, 512, 512);
    return canvas.toDataURL('image/webp', 0.92).split(',')[1];
  }, `data:image/png;base64,${bytes.toString('base64')}`);
  await mkdir('public/samples/masters', { recursive: true });
  await mkdir('public/samples/concepts', { recursive: true });
  await copyFile(resolve(input), `public/samples/masters/${id}.png`);
  await writeFile(`public/samples/concepts/${id}.webp`, Buffer.from(output, 'base64'));
} finally { await browser.close(); }

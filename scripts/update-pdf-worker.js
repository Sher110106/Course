#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the installed pdfjs-dist version
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const pdfjsVersion = packageJson.dependencies['pdfjs-dist'];

console.log(`Updating PDF worker to match pdfjs-dist version: ${pdfjsVersion}`);

// Copy the worker file from node_modules to public
// Try minified version first, fall back to non-minified
const possibleSources = [
  path.join('node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.mjs'),
  path.join('node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs'),
  path.join('node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs'),
  path.join('node_modules', 'pdfjs-dist', 'build', 'pdf.worker.mjs'),
];

const destPath = path.join('public', 'pdf.worker.js');

let copied = false;
for (const sourcePath of possibleSources) {
  if (fs.existsSync(sourcePath)) {
    try {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`✅ PDF worker updated successfully from ${sourcePath}`);
      copied = true;
      break;
    } catch (error) {
      console.error(`Failed to copy from ${sourcePath}:`, error.message);
    }
  }
}

if (!copied) {
  console.error('❌ Failed to find PDF worker file in node_modules');
  console.error('Tried paths:', possibleSources);
  process.exit(1);
} 
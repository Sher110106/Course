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
const sourcePath = path.join('node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs');
const destPath = path.join('public', 'pdf.worker.js');

try {
  fs.copyFileSync(sourcePath, destPath);
  console.log('✅ PDF worker updated successfully');
} catch (error) {
  console.error('❌ Failed to update PDF worker:', error.message);
  process.exit(1);
} 
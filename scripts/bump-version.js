// scripts/bump-version.js
import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ESM-safe equivalent of __dirname
const __dirname = dirname(fileURLToPath(import.meta.url));

const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, '0');
const dd = String(today.getDate()).padStart(2, '0');
const hh = String(today.getHours()).padStart(2, '0');
const min = String(today.getMinutes()).padStart(2, '0');
const newVersion = `${yyyy}.${mm}.${dd}-${hh}${min}`;

const pkgPath = join(__dirname, '../package.json');
const pkgRaw = await readFile(pkgPath, 'utf-8');
const pkg = JSON.parse(pkgRaw);

pkg.version = newVersion;

await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

console.log(`🔧 Bumped version to ${newVersion}`);

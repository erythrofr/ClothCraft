#!/usr/bin/env node
/** Read-only local file inventory. Never opens or extracts proprietary presets. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const roots = [
  { name: 'application_bundle', dir: '/Applications/CLO_Standalone_OnlineAuth.app/Contents/Resources/Preset' },
  { name: 'user_fabric_library', dir: path.join(os.homedir(), 'Documents/clo/Assets/Materials/Fabric') },
  { name: 'user_application_support', dir: path.join(os.homedir(), 'Library/Application Support/CLO') },
];
const categories = [
  ['Cotton', /^Cotton_/i], ['Denim', /^Denim_/i], ['Knit', /^Knit_/i],
  ['Silk', /^Silk_/i], ['Fur', /^Fur_/i], ['Sherpa fleece', /^Sherpa_/i],
  ['Wool', /^Wool(?:_|$)/i], ['Muslin', /^Muslin_/i],
  ['Nylon', /^Nylon_/i], ['Rib', /^Rib_/i], ['Trim', /^Trim_/i],
  ['Interlining', /^Interlining_/i], ['Leather', /^Leather_/i],
  ['Polyester', /^Polyester_/i], ['Linen', /^Linen(?:_|$)/i],
  ['Simulation defaults', /^\(Default/i],
];

function inventory(root) {
  const summary = { root: root.name, exists: fs.existsSync(root.dir), files: 0, extensions: {}, zfabCount: 0, zfabNames: [], categories: {}, unreadable: [] };
  if (!summary.exists) return summary;
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (error) { summary.unreadable.push({ directory: path.relative(root.dir, dir), code: error.code }); return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.isFile()) continue;
      summary.files++;
      const ext = (path.extname(entry.name).toLowerCase() || '[no extension]');
      summary.extensions[ext] = (summary.extensions[ext] || 0) + 1;
      if (ext !== '.zfab') continue;
      summary.zfabCount++;
      const relative = path.relative(root.dir, full);
      summary.zfabNames.push(relative);
      const category = categories.find(([, match]) => match.test(path.basename(entry.name, ext)))?.[0]
        || (root.name === 'application_bundle' ? path.dirname(relative).split(path.sep)[0] : 'Other');
      summary.categories[category] = (summary.categories[category] || 0) + 1;
    }
  }
  walk(root.dir);
  summary.zfabNames.sort((a, b) => a.localeCompare(b));
  summary.extensions = Object.fromEntries(Object.entries(summary.extensions).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
  summary.categories = Object.fromEntries(Object.entries(summary.categories).sort((a, b) => a[0].localeCompare(b[0])));
  return summary;
}

const result = { auditDate: new Date().toISOString(), methodology: 'Filename, extension, and directory metadata only; no preset contents read', roots: roots.map(inventory) };
result.totalZfabFileOccurrences = result.roots.reduce((sum, root) => sum + root.zfabCount, 0);
console.log(JSON.stringify(result, null, 2));

#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const EXTENSIONS = new Set(['.zpac', '.zfab', '.zprj', '.zmod', '.zacs', '.zavt', '.zip', '.dxf', '.obj', '.fbx', '.glb', '.gltf', '.png', '.jpg', '.jpeg', '.tif', '.tiff', '.exr', '.sbsar']);
const MAX_FILE = 2 * 1024 ** 3;
const MAX_ENTRIES = 10000;
const MAX_UNPACKED = 4 * 1024 ** 3;
const MAX_RATIO = 200;
const usage = `CLO-SET CONNECT manual-download library (local only)
Usage:
  node library.mjs import --source DIR --library DIR [--metadata metadata.json] [--dry-run]
  node library.mjs list --library DIR
  node library.mjs verify --library DIR
  node library.mjs stage --library DIR --id SHA256 --ack-license [--dry-run]
Metadata JSON: {"defaults":{"seller":"...","license":"...","licenseUrl":"...","originalUri":"..."},"files":{"name.zfab":{"seller":"...","license":"...","licenseUrl":"...","originalUri":"..."}}}
License values are recorded as supplied, never inferred. Stage requires a nonempty license and explicit acknowledgment. Items with unknown license remain in intake.
`;
function parse(argv) {
  const [command, ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i];
    if (!key.startsWith('--')) throw Error(`Unexpected argument ${key}`);
    if (['--dry-run', '--ack-license'].includes(key)) opts[key.slice(2)] = true;
    else {
      if (!rest[i + 1] || rest[i + 1].startsWith('--')) throw Error(`Missing value for ${key}`);
      opts[key.slice(2)] = rest[++i];
    }
  }
  return { command, opts };
}
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function archiveCheck(data) {
  if (data.length < 4 || data.readUInt32LE(0) !== 0x04034b50) return { kind: 'opaque', integrity: 'sha256-only' };
  const eocdStart = Math.max(0, data.length - 65557);
  let end = -1;
  for (let i = data.length - 22; i >= eocdStart; i--) if (data.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  if (end < 0) throw Error('ZIP end directory missing');
  const count = data.readUInt16LE(end + 10);
  const offset = data.readUInt32LE(end + 16);
  if (count > MAX_ENTRIES || count === 65535 || offset === 0xffffffff) throw Error('ZIP entry limit or unsupported ZIP64');
  let pos = offset, unpackedTotal = 0;
  for (let n = 0; n < count; n++) {
    if (pos + 46 > data.length || data.readUInt32LE(pos) !== 0x02014b50) throw Error('ZIP central directory invalid');
    const flags = data.readUInt16LE(pos + 8), method = data.readUInt16LE(pos + 10);
    const expectedCrc = data.readUInt32LE(pos + 16);
    const compressed = data.readUInt32LE(pos + 20), unpacked = data.readUInt32LE(pos + 24);
    const nameLength = data.readUInt16LE(pos + 28), extraLength = data.readUInt16LE(pos + 30), commentLength = data.readUInt16LE(pos + 32);
    const local = data.readUInt32LE(pos + 42);
    if (pos + 46 + nameLength + extraLength + commentLength > data.length) throw Error('ZIP metadata truncated');
    const name = data.subarray(pos + 46, pos + 46 + nameLength).toString('utf8');
    if (!name || name.includes('\\') || name.startsWith('/') || /^[A-Za-z]:/.test(name) || name.split('/').includes('..') || name.includes('\0')) throw Error(`Unsafe ZIP entry: ${name}`);
    if (flags & 1) throw Error('Encrypted ZIP entries are unsupported');
    if (![0, 8].includes(method)) throw Error(`Unsupported ZIP compression ${method}`);
    unpackedTotal += unpacked;
    if (unpackedTotal > MAX_UNPACKED || (compressed === 0 ? unpacked > 0 : unpacked / compressed > MAX_RATIO)) throw Error('ZIP expansion limit exceeded');
    if (local + 30 > data.length || data.readUInt32LE(local) !== 0x04034b50) throw Error('ZIP local header invalid');
    const dataStart = local + 30 + data.readUInt16LE(local + 26) + data.readUInt16LE(local + 28);
    if (dataStart + compressed > data.length) throw Error('ZIP member truncated');
    const bytes = data.subarray(dataStart, dataStart + compressed);
    const decoded = method === 0 ? bytes : inflateRawSync(bytes, { maxOutputLength: Math.max(1, unpacked) });
    if (decoded.length !== unpacked || crc32(decoded) !== expectedCrc) throw Error(`ZIP member checksum mismatch: ${name}`);
    pos += 46 + nameLength + extraLength + commentLength;
  }
  return { kind: 'zip', integrity: 'zip-crc32-and-sha256', entries: count };
}
async function readManifest(lib) {
  try { return JSON.parse(await fs.readFile(path.join(lib, 'manifest.json'), 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return { schemaVersion: 1, assets: [] }; throw e; }
}
async function saveManifest(lib, manifest) {
  await fs.mkdir(lib, { recursive: true });
  const tmp = path.join(lib, `manifest.${process.pid}.tmp`);
  await fs.writeFile(tmp, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  await fs.rename(tmp, path.join(lib, 'manifest.json'));
}
async function regularFiles(root, dir = root) {
  const result = [];
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isSymbolicLink()) continue;
    if (item.isDirectory()) result.push(...await regularFiles(root, full));
    else if (item.isFile() && EXTENSIONS.has(path.extname(item.name).toLowerCase())) result.push(full);
  }
  return result.sort();
}
async function processImport(opts) {
  if (!opts.source) throw Error('--source required');
  const lib = path.resolve(opts.library), source = path.resolve(opts.source);
  if (source === lib || lib.startsWith(source + path.sep) || source.startsWith(lib + path.sep)) throw Error('Source and library directories must be separate');
  const meta = opts.metadata ? JSON.parse(await fs.readFile(opts.metadata, 'utf8')) : {};
  const manifest = await readManifest(lib), events = [];
  for (const file of await regularFiles(source)) {
    const stat = await fs.stat(file);
    const relative = path.relative(source, file);
    if (stat.size > MAX_FILE) { events.push({ file: relative, status: 'rejected', reason: 'file-size-limit' }); continue; }
    try {
      const data = await fs.readFile(file);
      const archive = archiveCheck(data);
      const sha256 = createHash('sha256').update(data).digest('hex');
      const old = manifest.assets.find(a => a.sha256 === sha256);
      if (old) { events.push({ file: relative, status: 'duplicate', sha256 }); continue; }
      const info = { ...meta.defaults, ...meta.files?.[relative] };
      const asset = { sha256, filename: path.basename(file), sourceRelativePath: relative, extension: path.extname(file).toLowerCase(), size: data.length, originalUri: info.originalUri || null, seller: info.seller || null, license: info.license || null, licenseUrl: info.licenseUrl || null, licenseStatus: info.license ? 'unreviewed' : 'unknown', archive, intakePath: `intake/${sha256}${path.extname(file).toLowerCase()}`, importedAt: new Date().toISOString() };
      events.push({ file: relative, status: opts['dry-run'] ? 'would-import' : 'imported', sha256, licenseStatus: asset.licenseStatus });
      if (!opts['dry-run']) {
        await fs.mkdir(path.join(lib, 'intake'), { recursive: true });
        await fs.writeFile(path.join(lib, asset.intakePath), data, { flag: 'wx' });
        manifest.assets.push(asset);
      }
    } catch (e) { events.push({ file: relative, status: 'rejected', reason: e.message }); }
  }
  if (!opts['dry-run']) await saveManifest(lib, manifest);
  return events;
}
async function verify(lib) {
  const manifest = await readManifest(lib), results = [];
  for (const asset of manifest.assets) {
    try {
      const file = path.resolve(lib, asset.intakePath);
      if (!file.startsWith(path.resolve(lib) + path.sep)) throw Error('Unsafe manifest path');
      const data = await fs.readFile(file);
      if (createHash('sha256').update(data).digest('hex') !== asset.sha256) throw Error('SHA256 mismatch');
      archiveCheck(data);
      results.push({ sha256: asset.sha256, status: 'ok' });
    } catch (e) { results.push({ sha256: asset.sha256, status: 'failed', reason: e.message }); }
  }
  return results;
}
async function stage(opts) {
  const lib = path.resolve(opts.library), manifest = await readManifest(lib);
  const asset = manifest.assets.find(a => a.sha256 === opts.id);
  if (!asset) throw Error('Asset ID missing from manifest');
  if (!asset.license || !opts['ack-license']) throw Error('Staging blocked: recorded license and --ack-license required');
  const target = path.join(lib, 'staged', `${asset.sha256}${asset.extension}`);
  const source = path.resolve(lib, asset.intakePath);
  if (!source.startsWith(lib + path.sep)) throw Error('Unsafe manifest intake path');
  const data = await fs.readFile(source);
  if (createHash('sha256').update(data).digest('hex') !== asset.sha256) throw Error('Asset SHA256 mismatch');
  archiveCheck(data);
  if (!opts['dry-run']) {
    await fs.mkdir(path.dirname(target), { recursive: true });
    try { await fs.writeFile(target, data, { flag: 'wx' }); }
    catch (e) { if (e.code !== 'EEXIST') throw e; }
    asset.licenseStatus = 'acknowledged';
    asset.stagedAt = new Date().toISOString();
    await saveManifest(lib, manifest);
  }
  return { status: opts['dry-run'] ? 'would-stage' : 'staged', sha256: asset.sha256, path: target };
}
export async function run(argv) {
  const { command, opts } = parse(argv);
  if (command === 'help' || command === '--help' || !command) return usage;
  if (!['import', 'verify', 'list', 'stage'].includes(command)) throw Error(`Unknown command ${command}`);
  if (!opts.library) throw Error('--library required');
  if (command === 'import') return processImport(opts);
  if (command === 'verify') return verify(path.resolve(opts.library));
  if (command === 'list') return (await readManifest(path.resolve(opts.library))).assets;
  return stage(opts);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run(process.argv.slice(2)).then(result => console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2))).catch(e => { console.error(e.message); process.exitCode = 1; });
}

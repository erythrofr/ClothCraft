import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run } from './library.mjs';

test('manual intake deduplicates, verifies and gates staging on license acknowledgment', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'clo-connect-'));
  try {
    const source = path.join(dir, 'downloads'), lib = path.join(dir, 'library');
    await fs.mkdir(source);
    await fs.writeFile(path.join(source, 'sample.zfab'), 'fabric-test-bytes');
    const preview = await run(['import', '--source', source, '--library', lib, '--dry-run']);
    assert.equal(preview[0].status, 'would-import');
    await assert.rejects(fs.stat(path.join(lib, 'manifest.json')));
    const imported = await run(['import', '--source', source, '--library', lib]);
    assert.equal(imported[0].status, 'imported');
    assert.equal((await run(['import', '--source', source, '--library', lib]))[0].status, 'duplicate');
    const id = imported[0].sha256;
    assert.equal((await run(['verify', '--library', lib]))[0].status, 'ok');
    await assert.rejects(run(['stage', '--library', lib, '--id', id, '--ack-license']), /license/);
    const manifestPath = path.join(lib, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    manifest.assets[0].license = 'Creator supplied personal use license';
    await fs.writeFile(manifestPath, JSON.stringify(manifest));
    await assert.rejects(run(['stage', '--library', lib, '--id', id]), /ack-license/);
    assert.equal((await run(['stage', '--library', lib, '--id', id, '--ack-license', '--dry-run'])).status, 'would-stage');
    assert.equal((await run(['stage', '--library', lib, '--id', id, '--ack-license'])).status, 'staged');
    await fs.writeFile(path.join(lib, 'intake', `${id}.zfab`), 'tampered');
    assert.equal((await run(['verify', '--library', lib]))[0].status, 'failed');
    await assert.rejects(run(['stage', '--library', lib, '--id', id, '--ack-license']), /SHA256/);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('validates a ZIP directory and skips symbolic links', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'clo-connect-'));
  try {
    const source = path.join(dir, 'downloads'), lib = path.join(dir, 'library');
    await fs.mkdir(source);
    const zip = Buffer.alloc(22);
    zip.writeUInt32LE(0x06054b50, 0);
    await fs.writeFile(path.join(source, 'empty.zip'), zip);
    await fs.symlink(path.join(source, 'empty.zip'), path.join(source, 'linked.zip'));
    const events = await run(['import', '--source', source, '--library', lib]);
    assert.equal(events.length, 1);
    assert.equal(events[0].status, 'imported');
    assert.equal((await run(['verify', '--library', lib]))[0].status, 'ok');
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

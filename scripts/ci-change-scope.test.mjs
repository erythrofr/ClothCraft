import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyDiff, decide} from './ci-change-scope.mjs';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const diff = (...fields) => Buffer.from(fields.join('\0') + '\0');
const event = {pull_request: {base: {sha: 'a'.repeat(40)}, head: {sha: 'b'.repeat(40)}}};

test('only exact catalog paths qualify, including deletions and both rename sides', () => {
  for (const status of ['A', 'M', 'D']) {
    assert.equal(classifyDiff(diff(status, 'coordination/tasks.json')).mode, 'metadata');
  }
  assert.equal(classifyDiff(diff('R100', 'coordination/tasks.json', 'coordination/TASKS.md')).mode, 'metadata');
  for (const path of ['README.md', 'Cargo.lock', 'src/cloth.wgsl', 'assets/icon.png',
    'examples/templates/dress.json', '.github/workflows/cpu.yml', 'scripts/ci-change-scope.mjs',
    'docs/research.md', 'Coordination/tasks.json', '../coordination/tasks.json']) {
    for (const fields of [['M', path], ['M', 'coordination/tasks.json', 'D', path],
      ['R090', path, 'coordination/tasks.json'], ['R100', 'coordination/tasks.json', path]]) {
      assert.equal(classifyDiff(diff(...fields)).mode, 'full', path);
    }
  }
});

test('malformed, truncated, empty and non-UTF8 diffs fail closed', () => {
  for (const bytes of [Buffer.alloc(0), Buffer.from('M\0coordination/tasks.json'),
    diff('M'), diff('R100', 'coordination/tasks.json'), diff('X', 'coordination/tasks.json'),
    diff('M', ''), diff('M', 'coordination/tasks.json', ''), Buffer.from([255, 0])]) {
    assert.equal(classifyDiff(bytes).mode, 'full');
  }
});

test('non-PR events and invalid revision data never invoke git', () => {
  const unexpected = () => assert.fail('git should not run');
  for (const name of ['push', 'workflow_dispatch', undefined, 'pull_request_target']) {
    assert.equal(decide(name, event, unexpected).mode, 'full');
  }
  for (const invalid of [{}, null, {pull_request: {base: {sha: '--help'}}}]) {
    assert.equal(decide('pull_request', invalid, unexpected).mode, 'full');
  }
});

test('exact revisions are fetched and verified; every acquisition failure falls back', () => {
  const calls = [];
  const git = args => { calls.push(args); return diff('M', 'coordination/tasks.json'); };
  assert.equal(decide('pull_request', event, git).mode, 'metadata');
  assert.deepEqual(calls[0], ['fetch', '--no-tags', '--depth=1', 'origin', 'a'.repeat(40), 'b'.repeat(40)]);
  assert.equal(calls.length, 4);
  assert.deepEqual(calls[3].slice(-3), ['a'.repeat(40), 'b'.repeat(40), '--']);
  for (let failure = 0; failure < 4; failure++) {
    let index = 0;
    assert.equal(decide('pull_request', event, () => {
      if (index++ === failure) throw new Error('fetch, verification, timeout or buffer failure');
      return diff('M', 'coordination/tasks.json');
    }).mode, 'full');
  }
});

test('real local Git acquisition handles metadata and a rename into source', () => {
  const root = mkdtempSync(join(tmpdir(), 'clothcraft-ci-scope-'));
  const origin = join(root, 'origin');
  const checkout = join(root, 'checkout');
  const git = cwd => args => execFileSync('git', args, {cwd, stdio: ['ignore', 'pipe', 'pipe']});
  try {
    mkdirSync(origin);
    mkdirSync(checkout);
    const source = git(origin);
    source(['init']);
    source(['config', 'user.name', 'CI fixture']);
    source(['config', 'user.email', 'ci@example.invalid']);
    mkdirSync(join(origin, 'coordination'));
    writeFileSync(join(origin, 'coordination/tasks.json'), '{}\n');
    source(['add', '.']);
    source(['commit', '-m', 'base']);
    const base = source(['rev-parse', 'HEAD']).toString().trim();
    writeFileSync(join(origin, 'coordination/tasks.json'), '{"tasks": []}\n');
    source(['commit', '-am', 'metadata']);
    const metadataHead = source(['rev-parse', 'HEAD']).toString().trim();
    mkdirSync(join(origin, 'src'));
    source(['mv', 'coordination/tasks.json', 'src/data.json']);
    source(['commit', '-m', 'move into source']);
    const sourceHead = source(['rev-parse', 'HEAD']).toString().trim();
    const run = git(checkout);
    run(['init']);
    run(['remote', 'add', 'origin', origin]);
    const input = head => ({pull_request: {base: {sha: base}, head: {sha: head}}});
    assert.equal(decide('pull_request', input(metadataHead), run).mode, 'metadata');
    assert.equal(decide('pull_request', input(sourceHead), run).mode, 'full');
  } finally {
    // Only the unique fixture directory created above, never a user checkout.
    rmSync(root, {recursive: true, force: true});
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Guard trigger and isolation contracts without adding a package dependency.
// GitHub remains the validator of the complete workflow YAML and expressions.
for (const name of ['cpu', 'build', 'rewrite-catalog', 'release-windows']) {
  test(`${name}: no branch push/PR duplication or required-check path filtering`, () => {
    const source = readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8');
    const triggers = source.slice(source.indexOf('\non:'), source.indexOf('\nconcurrency:'));
    assert.match(triggers, /push:\s+branches: \[main\]/);
    assert.match(triggers, /\n  pull_request:\s/);
    assert.match(triggers, /\n  workflow_dispatch:\s/);
    assert.doesNotMatch(triggers, /paths|pull_request_target/);
    assert.match(source, /group: \$\{\{ github.workflow \}\}-\$\{\{ github.event_name \}\}-\$\{\{ github.event.pull_request.number \|\| github.run_id \}\}/);
    assert.match(source, /cancel-in-progress: \$\{\{ github.event_name == 'pull_request' \}\}/);
  });
}

test('coordinator retains its non-cancelling ledger writer and trusted checkout', () => {
  const source = readFileSync(new URL('../.github/workflows/agent-coordination.yml', import.meta.url), 'utf8');
  assert.match(source, /group: clothcraft-agent-coordination-v1/);
  assert.match(source, /cancel-in-progress: false/);
  assert.match(source, /ref: \$\{\{ github.event.repository.default_branch \}\}/);
  assert.doesNotMatch(source, /cancel-in-progress: true/);
});

test('Linux has one canonical CPU suite, with standalone manual builds covered', () => {
  const cpu = readFileSync(new URL('../.github/workflows/cpu.yml', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
  const build = readFileSync(new URL('../.github/workflows/build.yml', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
  const canonical = cpu.slice(cpu.indexOf('  cpu:'), cpu.indexOf('  desktop:'));
  assert.match(canonical, /runs-on: ubuntu-24\.04/);
  assert.match(canonical, /cargo test --locked --no-default-features -j 2 -- --test-threads=2/);
  assert.doesNotMatch(canonical, /\n\s+if:/); // The canonical suite must not become conditional.
  assert.match(build, /os: ubuntu-24\.04\s+artifact: linux-x86_64/);
  const testStep = build.match(/      - name: Test the CPU core without graphics features\n[\s\S]*?(?=\n      (?:- |#)|$)/)?.[0];
  assert.ok(testStep);
  assert.match(testStep, /if: runner.os != 'Linux' \|\| github.event_name == 'workflow_dispatch'/);
  assert.match(testStep, /cargo test --locked --no-default-features -j 2 -- --test-threads=2/);
  assert.match(build, /fail-fast: false/);
  assert.match(build, /Validate a shipped template with the built binary/);
});

test('dependency caches isolate jobs and lockfiles and never replace validation', () => {
  const keys = [];
  for (const name of ['cpu', 'build']) {
    const source = readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
    const blocks = source.match(/      - name: Restore Rust dependency cache\n[\s\S]*?(?=\n      (?:- |#)|$)/g) ?? [];
    assert.equal(blocks.length, name === 'cpu' ? 2 : 1);
    for (const block of blocks) {
      assert.match(block, /uses: Swatinem\/rust-cache@[0-9a-f]{40}\n/);
      assert.match(block, /hashFiles\('Cargo.lock'\)/);
      assert.match(block, /env-vars: ImageOS ImageVersion/);
      assert.match(block, /cache-bin: "false"/);
      assert.match(block, /cache-workspace-crates: "false"/);
      assert.match(block, /cache-on-failure: "false"/);
      assert.match(block, /save-if: \$\{\{ github.event_name == 'push' && github.ref == 'refs\/heads\/main' \}\}/);
      keys.push(block.match(/          key: (.+)/)[1]);
    }
    assert.doesNotMatch(source, /cache-hit|continue-on-error|pull_request_target/);
    assert.match(source, /cargo test --locked --no-default-features -j 2 -- --test-threads=2/);
  }
  assert.equal(new Set(keys).size, 3);
  assert.ok(keys.some(k => k.startsWith('cpu-no-default-dev-')));
  assert.ok(keys.some(k => k.startsWith('desktop-dev-')));
  assert.ok(keys.some(k => k.includes('matrix.artifact')));
});

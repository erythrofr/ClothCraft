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

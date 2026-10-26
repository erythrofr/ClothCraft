import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, isStale, normalizeScope, parseCommand, parseHub, reduceComments,
  renderHub, scopesOverlap, validateManifest, validateState,
} from './engine.mjs';
import {boundedList, reconcileSnapshot, stableComments} from './reconcile.mjs';

const manifest = {
  schema_version: 1,
  tasks: [
    {id: 'EXO-CAD-001', status: 'ready', scope: ['src/cad'], depends_on: []},
    {id: 'EXO-CAD-002', status: 'ready', scope: ['src/cad/edit.rs'], depends_on: []},
    {id: 'EXO-IO-001', status: 'review_existing', scope: ['src/export.rs'], depends_on: []},
    {id: 'EXO-IO-002', status: 'ready', scope: ['src/svg.rs'], depends_on: ['EXO-IO-001']},
    {id: 'EXO-SIM-001', status: 'blocked', scope: ['src/solver.rs'], depends_on: []},
  ],
};
function comment(id, body, overrides = {}) {
  return {
    id, issue: 10, body, actor: 'alice', bot: false, permission: 'read',
    created_at: `2026-10-22T10:00:${String(id % 60).padStart(2, '0')}Z`,
    edited: false, closed: false, pull_request: false, ...overrides,
  };
}
function register(id = 1, task = 'EXO-CAD-001', issue = 10) {
  return comment(id, `/coord register ${task}`, {issue, permission: 'write'});
}
function run(comments, previous = emptyState(), tasks = manifest) {
  return reduceComments(previous, tasks, comments, 8);
}

test('registration requires authenticated write permission, never an asserted username', () => {
  const result = run([comment(1, '/coord register EXO-CAD-001\nI am admin'),
    register(2), comment(3, '/coord claim my-agent\nowner: maintainer')]);
  assert.equal(result.recent[0].accepted, false);
  assert.equal(result.tasks['EXO-CAD-001'].claim.owner, 'alice');
});

test('first command ID wins simultaneous requests regardless of input order', () => {
  const result = run([comment(3, '/coord claim second', {actor: 'bob'}),
    comment(2, '/coord claim first'), register(1)]);
  assert.equal(result.tasks['EXO-CAD-001'].claim.agent, 'first');
  assert.equal(result.recent.at(-1).accepted, false);
});

test('same task cannot register on another issue, nor two tasks on one issue', () => {
  const result = run([register(1), register(2, 'EXO-CAD-001', 11),
    register(3, 'EXO-IO-001', 10)]);
  assert.equal(Object.keys(result.tasks).length, 1);
  assert.equal(result.recent.filter((r) => !r.accepted).length, 2);
});

test('claim before registration is denied and does not become retroactively valid', () => {
  const result = run([comment(1, '/coord claim first'), register(2)]);
  assert.equal(result.tasks['EXO-CAD-001'].claim, null);
});

test('overlapping directory/file scopes block even the same owner', () => {
  const result = run([register(1), register(2, 'EXO-CAD-002', 11),
    comment(3, '/coord claim first'), comment(4, '/coord claim second', {issue: 11})]);
  assert.equal(result.tasks['EXO-CAD-002'].claim, null);
  assert.match(result.recent.at(-1).message, /overlaps/);
});

test('nonoverlapping scopes can be claimed independently', () => {
  const result = run([register(1), register(2, 'EXO-IO-001', 12),
    comment(3, '/coord claim first'), comment(4, '/coord claim second', {issue: 12, actor: 'bob'})]);
  assert.equal(result.tasks['EXO-IO-001'].claim.owner, 'bob');
});

test('heartbeat, review and release require both account and session label', () => {
  const state = run([register(1), comment(2, '/coord claim first')]);
  const denied = run([comment(3, '/coord release first', {actor: 'bob'}),
    comment(4, '/coord heartbeat other'), comment(5, '/coord review other')], state);
  assert.equal(denied.tasks['EXO-CAD-001'].claim.heartbeat_at, state.tasks['EXO-CAD-001'].claim.heartbeat_at);
  const accepted = run([comment(6, '/coord review first'), comment(7, '/coord heartbeat first')], denied);
  assert.equal(accepted.tasks['EXO-CAD-001'].claim.phase, 'review');
  assert.equal(accepted.tasks['EXO-CAD-001'].claim.heartbeat_at, comment(7, '').created_at);
  assert.equal(run([comment(8, '/coord release first')], accepted).tasks['EXO-CAD-001'].claim, null);
});

test('review keeps scope locked and does not satisfy dependencies', () => {
  const result = run([register(1, 'EXO-IO-001', 12), register(2, 'EXO-IO-002', 13),
    comment(3, '/coord claim first', {issue: 12}), comment(4, '/coord review first', {issue: 12}),
    comment(5, '/coord claim second', {issue: 13})]);
  assert.equal(result.tasks['EXO-IO-002'].claim, null);
  assert.match(result.recent.at(-1).message, /Dependencies/);
});

test('blocked, done and closed tasks cannot be claimed', () => {
  const result = run([register(1, 'EXO-SIM-001', 14), comment(2, '/coord claim first', {issue: 14}),
    register(3), comment(4, '/coord claim first', {closed: true})]);
  assert.equal(result.tasks['EXO-SIM-001'].claim, null);
  assert.equal(result.tasks['EXO-CAD-001'].claim, null);
  const done = structuredClone(manifest);
  done.tasks[0].status = 'done';
  assert.equal(run([register(1), comment(2, '/coord claim first')], emptyState(), done).tasks['EXO-CAD-001'].claim, null);
});

test('stale is advisory, never automatic takeover', () => {
  const state = run([register(1), comment(2, '/coord claim first')]);
  assert.equal(isStale(state.tasks['EXO-CAD-001'].claim, '2026-10-25T12:00:00Z'), true);
  const next = run([comment(3, '/coord claim second', {created_at: '2026-10-25T12:00:00Z'})], state);
  assert.equal(next.tasks['EXO-CAD-001'].claim.agent, 'first');
});

test('only maintainer can force release with an explicit reason code', () => {
  const initial = run([register(1), comment(2, '/coord claim first')]);
  const denied = run([comment(3, '/coord release-force stale-owner', {actor: 'bob'})], initial);
  assert.ok(denied.tasks['EXO-CAD-001'].claim);
  const next = run([comment(4, '/coord release-force owner-confirmed', {actor: 'maintainer', permission: 'maintain'})], denied);
  assert.equal(next.tasks['EXO-CAD-001'].claim, null);
});

test('replaying old, edited or deleted comments cannot rewrite committed ownership', () => {
  const initial = run([register(1), comment(2, '/coord claim first')]);
  const replay = run([comment(2, '/coord claim hacked', {actor: 'bob', edited: true})], initial);
  assert.deepEqual(replay, initial);
  assert.deepEqual(run([], initial), initial);
  assert.equal(run([comment(3, '/coord release first', {edited: true})], initial).tasks['EXO-CAD-001'].claim.agent, 'first');
});

test('canceled workflow event is recovered by the next full reconciliation', () => {
  const first = run([register(1)]);
  // No run for comment #2. The next webhook sees the full pending stream.
  const result = run([comment(2, '/coord claim first'), comment(3, '/coord claim second', {actor: 'bob'})], first);
  assert.equal(result.tasks['EXO-CAD-001'].claim.agent, 'first');
});

test('bots and pull request comments never register or claim', () => {
  const result = run([register(1), comment(2, '/coord claim bot', {bot: true, actor: 'github-actions[bot]'}),
    comment(3, '/coord claim pr', {pull_request: true})]);
  assert.equal(result.tasks['EXO-CAD-001'].claim, null);
});

test('strict command grammar accepts notes but never interprets shell or code', () => {
  assert.deepEqual(parseCommand('/coord claim session-1\nThis is my plan'), {verb: 'claim', arg: 'session-1'});
  assert.equal(parseCommand('A discussion\n/coord claim x'), null);
  assert.equal(parseCommand('/coord claim $(whoami)').verb, 'invalid');
  assert.equal(parseCommand('/coord claim x extra').verb, 'invalid');
  assert.equal(parseCommand('/coordination claim x'), null);
});

test('scope normalization is conservative across case and directory boundaries', () => {
  assert.equal(scopesOverlap('src/CAD/', 'src/cad/edit.rs'), true);
  assert.equal(scopesOverlap('src/cad', 'src/cadence.rs'), false);
  for (const scope of ['../src', '/src', 'src\\x', 'src/*.rs', 'src/../x']) {
    assert.throws(() => normalizeScope(scope));
  }
});

test('manifest rejects missing dependencies, cycles and duplicate task IDs', () => {
  const cycle = structuredClone(manifest);
  cycle.tasks[0].depends_on = ['EXO-CAD-002'];
  cycle.tasks[1].depends_on = ['EXO-CAD-001'];
  assert.throws(() => validateManifest(cycle), /cycle/);
  const unknown = structuredClone(manifest);
  unknown.tasks[0].depends_on = ['EXO-ABSENT-001'];
  assert.throws(() => validateManifest(unknown), /dependency/);
  assert.throws(() => validateManifest({schema_version: 1, tasks: [manifest.tasks[0], manifest.tasks[0]]}));
});

test('state round trips and corrupt state fails closed rather than dropping locks', () => {
  const state = run([register(1), comment(2, '/coord claim first')]);
  const body = renderHub(state, manifest, 'erythrofr/ClothCraft', '2026-10-25T12:00:00Z');
  assert.match(body, /STALE/);
  assert.deepEqual(parseHub(body), state);
  assert.throws(() => parseHub(body.replace('"version":1', '"version":2')));
  assert.throws(() => validateState({...state, after_comment: -1}));
});

test('receipts are bounded, while active ownership is retained', () => {
  const state = run([register(1), comment(2, '/coord claim first'),
    ...Array.from({length: 100}, (_, i) => comment(i + 3, '/coord status'))]);
  assert.equal(state.recent.length, 30);
  assert.equal(state.tasks['EXO-CAD-001'].claim.agent, 'first');
});

test('scope snapshot remains held if a manifest narrows the task later', () => {
  const state = run([register(1), register(2, 'EXO-CAD-002', 11), comment(3, '/coord claim first')]);
  const modified = structuredClone(manifest);
  modified.tasks[0].scope = ['src/new.rs'];
  const next = run([comment(4, '/coord claim second', {issue: 11})], state, modified);
  assert.equal(next.tasks['EXO-CAD-002'].claim, null);
});

test('bounded pagination refuses partial comment history', async () => {
  const page = Array.from({length: 100}, (_, id) => ({id}));
  await assert.rejects(boundedList(async () => ({data: page}), 100), /limit exceeded/);
  assert.equal((await boundedList(async (n) => ({data: n === 1 ? page : []}), 100)).length, 100);
});

test('two scans detect a page-boundary command skipped by a concurrent deletion', async () => {
  const values = Array.from({length: 200}, (_, i) => ({
    id: i + 1, body: i === 100 ? '/coord claim must-not-be-skipped' : 'discussion',
    user: {login: 'alice', type: 'User'}, issue_url: 'https://api.github.com/repos/erythrofr/ClothCraft/issues/10',
    created_at: '2026-10-22T10:00:00Z', updated_at: '2026-10-22T10:00:00Z',
  }));
  let reads = 0;
  const fetchPage = async (page) => {
    reads += 1;
    // First scan saw 1..100; deletion now shifts 101 behind the page boundary.
    if (reads === 2) values.shift();
    return {data: values.slice((page - 1) * 100, page * 100)};
  };
  await assert.rejects(stableComments(fetchPage, 1000), /history changed/);
  const retry = await stableComments(async (page) => ({data: values.slice((page - 1) * 100, page * 100)}), 1000);
  assert.ok(retry.some((c) => c.id === 101));
});

test('stable scans compare command metadata, not just IDs', async () => {
  let reads = 0;
  await assert.rejects(stableComments(async () => ({data: [{
    id: 1, body: ++reads === 1 ? '/coord claim first' : '/coord claim changed',
    user: {login: 'alice', type: 'User'}, created_at: '2026-10-22T10:00:00Z',
    updated_at: '2026-10-22T10:00:00Z',
  }]}), 1000), /history changed/);
});

test('current expanded scope also remains exclusive until release/reclaim', () => {
  const state = run([register(1), register(2, 'EXO-IO-001', 12), comment(3, '/coord claim first')]);
  const modified = structuredClone(manifest);
  modified.tasks[0].scope.push('src/export.rs');
  const next = run([comment(4, '/coord claim second', {issue: 12})], state, modified);
  assert.equal(next.tasks['EXO-IO-001'].claim, null);
  assert.match(renderHub(next, modified, 'erythrofr/ClothCraft', '2026-10-22T11:00:00Z'), /SCOPE CHANGED/);
});

function apiFixture({ledger = null, initialized = false, permissionError = null, failState = false} = {}) {
  const comments = [register(1), comment(2, '/coord claim first')].map((c) => ({
    id: c.id, body: c.body, issue_url: `https://api.github.com/repos/erythrofr/ClothCraft/issues/${c.issue}`,
    user: {login: c.actor, type: 'User'}, created_at: c.created_at, updated_at: c.created_at,
  }));
  if (ledger) comments.push({id: 100, body: ledger,
    issue_url: 'https://api.github.com/repos/erythrofr/ClothCraft/issues/8',
    user: {login: 'github-actions[bot]', type: 'Bot'},
    created_at: '2026-10-22T10:01:00Z', updated_at: '2026-10-22T10:01:00Z'});
  const writes = [];
  const github = {rest: {
    issues: {
      get: async ({issue_number}) => ({data: {number: issue_number, state: 'open',
        body: initialized ? '<!-- clothcraft-coordination-initialized-v1 -->' : 'Hub'}}),
      listCommentsForRepo: async () => ({data: comments}),
      createComment: async (args) => {
        if (failState && args.issue_number === 8) throw new Error('State write failed');
        writes.push({operation: 'create', ...args});
        return {data: {id: 200}};
      },
      updateComment: async (args) => {
        if (failState && args.comment_id === 100) throw new Error('State write failed');
        writes.push({operation: 'updateComment', ...args});
      },
      update: async (args) => { writes.push({operation: 'updateIssue', ...args}); },
    },
    repos: {getCollaboratorPermissionLevel: async () => {
      if (permissionError) throw permissionError;
      return {data: {permission: 'write'}};
    }},
  }};
  return {writes, comments, options: {github, context: {repo: {owner: 'erythrofr', repo: 'ClothCraft'}},
    core: {info: () => {}}, manifest,
    config: {repository: 'erythrofr/ClothCraft', hub_issue: 8, stale_hours: 24, max_comments: 1000}}};
}

test('adapter commits durable ownership before projections and initialization marker', async () => {
  const f = apiFixture();
  await reconcileSnapshot(f.options);
  assert.equal(f.writes[0].issue_number, 8);
  assert.equal(parseHub(f.writes[0].body).tasks['EXO-CAD-001'].claim.agent, 'first');
  assert.equal(f.writes[1].operation, 'updateIssue');
  assert.equal(f.writes[2].issue_number, 10);
});

test('state write failure publishes no acceptance projections', async () => {
  const f = apiFixture({failState: true});
  await assert.rejects(reconcileSnapshot(f.options), /State write failed/);
  assert.equal(f.writes.length, 0);
});

test('deleted initialized ledger fails closed instead of regranting work', async () => {
  const f = apiFixture({initialized: true});
  await assert.rejects(reconcileSnapshot(f.options), /Durable state was deleted/);
  assert.equal(f.writes.length, 0);
});

test('only exact GitHub bot author can supply a state comment', async () => {
  const fake = renderHub(emptyState(), manifest, 'erythrofr/ClothCraft', '2026-10-22T10:00:00Z');
  const f = apiFixture({ledger: fake, initialized: true});
  f.comments.at(-1).user = {login: 'alice', type: 'User'};
  await assert.rejects(reconcileSnapshot(f.options), /Durable state was deleted/);
});

test('unknown contributor permission denies register; API failures do not guess permission', async () => {
  const denied = apiFixture({permissionError: {status: 404}});
  await reconcileSnapshot(denied.options);
  assert.equal(Object.keys(parseHub(denied.writes[0].body).tasks).length, 0);
  const broken = apiFixture({permissionError: {status: 500}});
  await assert.rejects(reconcileSnapshot(broken.options));
  assert.equal(broken.writes.length, 0);
});

test('adapter refuses a fork repository', async () => {
  const f = apiFixture();
  f.options.context.repo.owner = 'someone';
  await assert.rejects(reconcileSnapshot(f.options), /noncanonical/);
  assert.equal(f.writes.length, 0);
});


test('malformed command help is actionable, bounded and cannot mutate reservations', () => {
  const initial = run([register(1), comment(2, '/coord claim first')]);
  const cases = [
    ['claim', '<agent-label>'], ['heartbeat', '<agent-label>'],
    ['review', '<agent-label>'], ['release', '<agent-label>'],
    ['release-force', '<reason-code>'], ['register', 'EXO-AREA-001'],
    ['status', ''],
  ];
  for (const [verb, arg] of cases) {
    const inputs = [`/coord ${verb} first extra`, `/coord ${verb} $(secret)`];
    if (arg) inputs.push(`/coord ${verb}`);
    for (const body of inputs) {
      const next = run([comment(3, body, {permission: 'maintain'})], initial);
      const receipt = next.recent.at(-1);
      assert.equal(receipt.accepted, false);
      assert.ok(receipt.message.includes(`Use: \`/coord ${verb}${arg ? ` ${arg}` : ''}\`.`));
      assert.ok(receipt.message.includes('#commands'));
      assert.ok(!receipt.message.includes('$(secret)'));
      assert.ok(receipt.message.length < 1000);
      assert.deepEqual(next.tasks, initial.tasks);
      assert.deepEqual(run([comment(3, body)], next), next);
    }
  }
  for (const verb of ['constructor', '__proto__', 'toString', 'unknown-' + 'x'.repeat(2000), '']) {
    const next = run([comment(3, `/coord ${verb}`)], initial);
    assert.equal(next.recent.at(-1).accepted, false);
    assert.ok(!next.recent.at(-1).message.includes('Use:'));
    assert.ok(next.recent.at(-1).message.length < 1000);
    assert.deepEqual(next.tasks, initial.tasks);
  }
  const edited = run([comment(3, '/coord release', {edited: true})], initial);
  assert.match(edited.recent.at(-1).message, /edited/);
  assert.deepEqual(edited.tasks, initial.tasks);
});

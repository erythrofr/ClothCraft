// A deterministic reducer; GitHub I/O lives in reconcile.mjs.
// Comments are data, never executable instructions.
export const STATE_MARKER = '<!-- clothcraft-coordination-state-v1 -->';
export const TASK_MARKER = '<!-- clothcraft-coordination-task-v1 -->';
const ID = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/;
const AGENT = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
const LOGIN = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}(?:\[bot\])?$/;
const PERMISSIONS = new Set(['admin', 'maintain', 'write']);
const COMMANDS_URL = 'https://github.com/erythrofr/ClothCraft/blob/main/docs/agent-coordination-protocol.md#commands';
// Fixed help strings only: never reflect arbitrary comment text in receipts.
const COMMAND_USAGE = new Map([
  ['status', '/coord status'],
  ['register', '/coord register EXO-AREA-001'],
  ...['claim', 'heartbeat', 'release', 'review'].map(verb => [verb, `/coord ${verb} <agent-label>`]),
  ['release-force', '/coord release-force <reason-code>'],
]);
const STATUSES = new Set(['ready', 'blocked', 'review_existing', 'done']);
const natural = (n) => Number.isSafeInteger(n) && n >= 0;
const positive = (n) => natural(n) && n > 0;
const timestamp = (s) => typeof s === 'string' && Number.isFinite(Date.parse(s));

export function normalizeScope(scope) {
  if (typeof scope !== 'string' || !scope || scope.length > 300 ||
      /[\\*?\[\]<>\r\n]/.test(scope) || scope.startsWith('/') ||
      scope.split('/').some((part) => part === '..' || part === '.')) {
    throw new Error(`Invalid repository scope: ${JSON.stringify(scope)}`);
  }
  return scope.replace(/\/+$/, '').toLowerCase();
}

export function scopesOverlap(a, b) {
  const left = normalizeScope(a);
  const right = normalizeScope(b);
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

export function validateManifest(manifest) {
  if (manifest?.schema_version !== 1 || !Array.isArray(manifest.tasks)) {
    throw new Error('Expected task manifest schema_version 1');
  }
  const tasks = new Map();
  for (const task of manifest.tasks) {
    if (!ID.test(task.id) || tasks.has(task.id) || !STATUSES.has(task.status) ||
        !Array.isArray(task.scope) || !task.scope.length ||
        !Array.isArray(task.depends_on)) throw new Error('Invalid or duplicate task');
    task.scope.forEach(normalizeScope);
    tasks.set(task.id, task);
  }
  for (const task of tasks.values()) {
    if (task.depends_on.some((id) => !tasks.has(id) || id === task.id)) {
      throw new Error(`Unknown or self dependency in ${task.id}`);
    }
  }
  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) throw new Error(`Dependency cycle at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    tasks.get(id).depends_on.forEach(visit);
    visiting.delete(id);
    visited.add(id);
  };
  [...tasks.keys()].forEach(visit);
  return tasks;
}

export function emptyState() {
  return {version: 1, after_comment: 0, tasks: {}, recent: []};
}

export function validateState(state) {
  if (state?.version !== 1 || !natural(state.after_comment) ||
      !state.tasks || typeof state.tasks !== 'object' || Array.isArray(state.tasks) ||
      !Array.isArray(state.recent) || state.recent.length > 30) {
    throw new Error('Invalid coordinator state; stop rather than reset claims');
  }
  const issues = new Set();
  for (const [id, entry] of Object.entries(state.tasks)) {
    if (!ID.test(id) || !positive(entry.issue) || issues.has(entry.issue)) {
      throw new Error('Invalid task registration state');
    }
    issues.add(entry.issue);
    if (entry.claim) {
      const c = entry.claim;
      if (!LOGIN.test(c.owner) || !AGENT.test(c.agent) || !positive(c.comment) ||
          !timestamp(c.started_at) || !timestamp(c.heartbeat_at) ||
          !['working', 'review'].includes(c.phase) ||
          !Array.isArray(c.scope) || !c.scope.length) throw new Error('Invalid claim state');
      c.scope.forEach(normalizeScope);
    }
  }
  for (const item of state.recent) {
    if (!positive(item.comment) || !positive(item.issue) || !LOGIN.test(item.actor) ||
        typeof item.accepted !== 'boolean' || typeof item.message !== 'string' ||
        item.message.length > 1000) throw new Error('Invalid command receipt state');
  }
  return state;
}

export function parseCommand(body) {
  if (typeof body !== 'string') return null;
  const line = body.split(/\r?\n/, 1)[0].trim();
  if (!line.startsWith('/coord')) return null;
  const pieces = line.split(/\s+/);
  if (pieces[0] !== '/coord') return null;
  const [_, verb, arg, ...extra] = pieces;
  const valid = (verb === 'status' && !arg) ||
    (verb === 'register' && ID.test(arg ?? '') && !extra.length) ||
    (['claim', 'heartbeat', 'release', 'review'].includes(verb) &&
      AGENT.test(arg ?? '') && !extra.length) ||
    (verb === 'release-force' && AGENT.test(arg ?? '') && !extra.length);
  return valid ? {verb, arg} : {verb: 'invalid', usage: COMMAND_USAGE.get(verb) ?? null};
}

export function reduceComments(previous, manifest, comments, hubIssue) {
  validateState(previous);
  const tasks = validateManifest(manifest);
  const state = structuredClone(previous);
  const ordered = [...comments].sort((a, b) => a.id - b.id);
  for (const event of ordered) {
    if (!positive(event.id) || event.id <= state.after_comment) continue;
    if (!positive(event.issue) || !LOGIN.test(event.actor ?? '') || !timestamp(event.created_at)) {
      throw new Error('Invalid GitHub comment metadata');
    }
    state.after_comment = event.id;
    if (event.bot || event.pull_request) continue;
    const command = parseCommand(event.body);
    if (!command) continue;
    const receipt = (accepted, message) => {
      state.recent.push({comment: event.id, issue: event.issue, actor: event.actor, accepted, message});
      state.recent = state.recent.slice(-30);
    };
    if (event.edited) {
      receipt(false, 'Command was edited before processing. Post a new comment instead.');
      continue;
    }
    if (command.verb === 'invalid') {
      receipt(false, `Malformed command. ${command.usage ? `Use: \`${command.usage}\`. ` : ''}Post a new comment; see ${COMMANDS_URL}`);
      continue;
    }
    if (command.verb === 'status') {
      receipt(true, 'Status refreshed. This does not renew or release a claim.');
      continue;
    }
    const privileged = PERMISSIONS.has(event.permission);
    if (command.verb === 'register') {
      if (!privileged) receipt(false, 'Registration requires repository write permission.');
      else if (event.issue === hubIssue) receipt(false, 'Register a separate task issue, not the hub.');
      else if (!tasks.has(command.arg)) receipt(false, 'Task ID is absent from the trusted manifest.');
      else if (state.tasks[command.arg]) {
        receipt(state.tasks[command.arg].issue === event.issue,
          `Task already registered to issue #${state.tasks[command.arg].issue}.`);
      } else if (Object.values(state.tasks).some((t) => t.issue === event.issue)) {
        receipt(false, 'This issue is already registered to another task.');
      } else {
        state.tasks[command.arg] = {issue: event.issue, claim: null};
        receipt(true, `Registered ${command.arg}.`);
      }
      continue;
    }
    const pair = Object.entries(state.tasks).find(([, t]) => t.issue === event.issue);
    if (!pair) {
      receipt(false, 'No registered task on this issue. A maintainer must register it first.');
      continue;
    }
    const [taskId, registration] = pair;
    const task = tasks.get(taskId);
    if (command.verb === 'claim') {
      if (!task) receipt(false, 'Task was removed from the manifest; ask a maintainer.');
      else if (event.closed) receipt(false, 'This task issue is closed. Reopen it before claiming.');
      else if (!['ready', 'review_existing'].includes(task.status)) {
        receipt(false, `Task is ${task.status}; it cannot be claimed.`);
      } else if (task.depends_on.some((id) => tasks.get(id).status !== 'done')) {
        receipt(false, 'Dependencies are not marked done in the reviewed manifest.');
      } else if (registration.claim) {
        receipt(false, `Already claimed by ${registration.claim.owner}/${registration.claim.agent}; no renewal performed.`);
      } else {
        // Hold both the originally granted paths and the current reviewed
        // scope. A manifest edit must not silently create a second owner.
        const conflict = Object.entries(state.tasks).find(([id, t]) => t.claim &&
          [...t.claim.scope, ...(tasks.get(id)?.scope ?? [])]
            .some((a) => task.scope.some((b) => scopesOverlap(a, b))));
        if (conflict) receipt(false, `Scope overlaps active ${conflict[0]} on issue #${conflict[1].issue}.`);
        else {
          registration.claim = {
            owner: event.actor.toLowerCase(), agent: command.arg,
            comment: event.id, started_at: event.created_at, heartbeat_at: event.created_at,
            phase: 'working', scope: [...task.scope],
          };
          receipt(true, `Claim accepted for ${taskId} by ${event.actor}/${command.arg}.`);
        }
      }
      continue;
    }
    if (command.verb === 'release-force') {
      if (!privileged) receipt(false, 'Forced release requires repository write permission.');
      else {
        registration.claim = null;
        receipt(true, `Maintainer released ${taskId}; reason code: ${command.arg}.`);
      }
      continue;
    }
    const claim = registration.claim;
    if (!claim || claim.owner !== event.actor.toLowerCase() || claim.agent !== command.arg) {
      receipt(false, 'Only the claiming GitHub account and matching agent label may do this.');
    } else if (command.verb === 'release') {
      registration.claim = null;
      receipt(true, `Released ${taskId}. This does not mark the task done.`);
    } else {
      claim.heartbeat_at = event.created_at;
      if (command.verb === 'review') claim.phase = 'review';
      receipt(true, command.verb === 'review'
        ? `Review requested for ${taskId}; ownership and scope lock remain active.`
        : `Heartbeat accepted for ${taskId}.`);
    }
  }
  return validateState(state);
}

export function isStale(claim, now, staleHours = 24) {
  return Date.parse(now) - Date.parse(claim.heartbeat_at) > staleHours * 3600000;
}

function safe(text) {
  return String(text).replace(/[&<>|`\r\n]/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '|': '&#124;', '`': '&#96;', '\r': ' ', '\n': ' ',
  })[ch]);
}

export function renderHub(state, manifest, repository, now, staleHours = 24) {
  validateState(state);
  const tasks = validateManifest(manifest);
  const lines = [STATE_MARKER, '# Agent coordination — authoritative state', '',
    'Wait for your accepted claim here before coding. A stale claim is still locked.', '',
    '| Task | Issue | Owner / agent | State | Last heartbeat (UTC) |',
    '|---|---|---|---|---|'];
  for (const [id, entry] of Object.entries(state.tasks).sort()) {
    const c = entry.claim;
    const scopeChanged = c && JSON.stringify(c.scope.map(normalizeScope).sort()) !==
      JSON.stringify((tasks.get(id)?.scope ?? []).map(normalizeScope).sort());
    const status = c ? `${c.phase}${isStale(c, now, staleHours) ? ' · STALE — contact owner' : ''}${scopeChanged ? ' · SCOPE CHANGED — release/reclaim' : ''}`
      : (tasks.get(id)?.status ?? 'removed — maintainer review');
    lines.push(`| ${safe(id)} | #${entry.issue} | ${c ? `${safe(c.owner)} / ${safe(c.agent)}` : '—'} | ${status} | ${c?.heartbeat_at ?? '—'} |`);
  }
  lines.push('', '## Recent command receipts', '', 'Older command comments remain in their task issues.');
  for (const item of [...state.recent].reverse()) {
    lines.push(`- [${item.accepted ? 'Accepted' : 'Rejected'} #${item.comment}](https://github.com/${repository}/issues/${item.issue}#issuecomment-${item.comment}): ${safe(item.message)}`);
  }
  lines.push('', '<details><summary>Machine state — do not edit or delete</summary>', '',
    '```json', JSON.stringify(state), '```', '</details>');
  const body = lines.join('\n');
  if (body.length > 60000) throw new Error('Coordinator state nearing comment capacity; maintainer migration required');
  return body;
}

export function parseHub(body) {
  if (!body.startsWith(`${STATE_MARKER}\n`)) throw new Error('Invalid hub marker');
  const match = /```json\n([^\n]+)\n```/.exec(body);
  if (!match) throw new Error('Missing durable coordinator state');
  return validateState(JSON.parse(match[1]));
}

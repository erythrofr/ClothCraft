import {execFileSync} from 'node:child_process';
import {appendFileSync, readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

// These files describe work, not shipped software. Catalog/coordinator checks
// still run. Do not broaden this to Markdown: README.md ships in archives.
const metadata = new Set(['coordination/tasks.json', 'coordination/TASKS.md']);
const full = reason => ({mode: 'full', reason});

export function classifyDiff(bytes) {
  try {
    const text = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
    if (!text || !text.endsWith('\0')) return full('Missing or incomplete diff');
    const fields = text.slice(0, -1).split('\0');
    const paths = [];
    for (let i = 0; i < fields.length;) {
      const status = fields[i++];
      if (!/^(?:[AMD]|[RC](?:100|[1-9]?\d))$/.test(status)) {
        return full('Unknown diff status');
      }
      const count = /^[RC]/.test(status) ? 2 : 1;
      for (let j = 0; j < count; j++) {
        const path = fields[i++];
        if (!path) return full('Incomplete diff record');
        paths.push(path);
      }
    }
    if (!paths.length || paths.some(path => !metadata.has(path))) {
      return full('Changes outside the metadata allowlist');
    }
    return {mode: 'metadata', reason: 'Only reviewed catalog metadata changed'};
  } catch {
    return full('Diff decoding failed');
  }
}

export function decide(eventName, event, git = args => execFileSync('git', args, {
  maxBuffer: 8 * 1024 * 1024, timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'],
})) {
  if (eventName !== 'pull_request') return full('Main/manual or unknown event');
  const base = event?.pull_request?.base?.sha;
  const head = event?.pull_request?.head?.sha;
  if (![base, head].every(sha => typeof sha === 'string' && /^[a-f0-9]{40}$/.test(sha))) {
    return full('Missing or invalid exact revisions');
  }
  try {
    // Argument arrays, never shell interpolation of event data. Fetch both
    // immutable objects even when checkout only contains a shallow merge ref.
    git(['fetch', '--no-tags', '--depth=1', 'origin', base, head]);
    for (const sha of [base, head]) git(['cat-file', '-e', `${sha}^{commit}`]);
    return classifyDiff(git(['diff', '--no-ext-diff', '--no-textconv',
      '--name-status', '-z', '--find-renames', base, head, '--']));
  } catch {
    return full('Exact revision acquisition or diff failed');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let decision;
  try {
    decision = decide(process.env.GITHUB_EVENT_NAME,
      JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')));
  } catch {
    decision = full('Event could not be read');
  }
  console.log(JSON.stringify(decision));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `mode=${decision.mode}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `### Validation scope: ${decision.mode}\n${decision.reason}.\n` +
    (decision.mode === 'metadata'
      ? 'Compilation, native smoke and packaging are intentionally skipped; no binaries are published. Catalog and coordination checks remain required.\n'
      : 'Full validation and packaging remain enabled.\n'));
}

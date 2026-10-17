#!/usr/bin/env node
// Generate local reviewable markdown backlog drafts. Never creates remote issues.
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const input=path.join(root,'docs/OPEN_SOURCE_ISSUE_BOARD_STARTER.md');
const output=process.argv[2] ? path.resolve(process.argv[2]) : path.join(root,'public_issue_drafts');
if (!fs.existsSync(input)) throw new Error('Missing contributor issue starter document');
if (fs.existsSync(output) && fs.readdirSync(output).length) throw new Error('Output must not contain existing files');
fs.mkdirSync(output,{recursive:true});
const source=fs.readFileSync(input,'utf8');
const items=[...source.matchAll(/^\d+\. (.*)$/gm)].map(m=>m[1]);
for(let i=0;i<items.length;i++){
  const title=items[i];
  const slug=title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60);
  fs.writeFileSync(path.join(output,`draft-${String(i+1).padStart(2,'0')}-${slug}.md`),`# ${title}\n\n> Draft only — validate current code and acceptance criteria before posting publicly.\n\n## Current baseline and evidence\n\nTODO: Link concrete source paths and reproducer.\n\n## Acceptance criteria\n\n- [ ] Reproduction/baseline documented\n- [ ] Measurable desired behavior specified\n- [ ] Tests included or reason for omission recorded\n- [ ] Third-party rights/dependencies reviewed\n\n## Team, priority, roadmap ID and dependencies\n\nTODO: Assign area, priority, GS requirement ID, dependency issues and reviewer.\n`);
}
console.log(`Generated ${items.length} local draft issue files in ${output}. Nothing published.`)

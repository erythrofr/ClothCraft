#!/usr/bin/env node
// Copy an allowlisted, reviewable source snapshot. Does not publish or change the working tree.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const root = process.cwd();
const destination = process.argv[2] ? path.resolve(process.argv[2]) : path.join(os.tmpdir(), 'garment-studio-public-candidate');
if (destination === root || destination.startsWith(root + path.sep)) throw new Error('Destination must be outside the working repository');
const top = ['src','public','scripts','native_app','native_backend','ppf_backend','blender_bridge','.github','integrations'];
const safeDocs = ['docs/ARCHITECTURE.md','docs/BACKEND_API.md','docs/LICENSING.md','docs/GARMENT_STUDIO_COMPLETE_CLO3D_PARITY_MASTER_PLAN_2026-10-13.md','docs/OPEN_SOURCE_ISSUE_BOARD_STARTER.md','docs/OPEN_SOURCE_GITHUB_LAUNCH_PLAYBOOK.md'];
const files = ['.github/CODEOWNERS','README.md','LICENSE','SECURITY.md','CONTRIBUTING.md','CODE_OF_CONDUCT.md','package.json','package-lock.json','vite.config.mjs','index.html','.gitignore'];
const prohibited = [/thomas/i,/(^|\/)(vendor|runtime|output|build|dist|node_modules|\.git|oss|venvs|models|downloads|\.venv|qa|captures)\//i,/\.(glb|fbx|blend|blend1|blend2|mp4|mov|zip|dylib|so|a|bin|pt|pth|onnx|safetensors|pem|key)$/i,/(^|\/)\.env(\.|$)/i,/(^|\/)(private|secrets?)(\/|\.)/i];
const approvedNativeFixtures = new Set(['tee-quality.native-sim.json','hoodie-quality.native-sim.json','pants.native-sim.json','zip-hoodie-quality.native-sim.json']);
const allowedExt = new Set(['.png','.jpg','.jpeg','.webp','.woff','.woff2','.js','.jsx','.mjs','.cjs','.ts','.tsx','.css','.html','.json','.md','.txt','.py','.cpp','.cc','.c','.h','.hpp','.swift','.sh','.yml','.yaml','.svg','.xml','.plist','.gitignore','.toml','.cmake','.metal','.obj']);
let copied=0,excluded=[];
function visit(rel){const full=path.join(root,rel);if(!fs.existsSync(full))return;if(prohibited.some(r=>r.test(rel))){excluded.push(rel);return;}const stat=fs.lstatSync(full);if(stat.isSymbolicLink()){excluded.push(rel+' [symlink]');return;}if(stat.isDirectory()){for(const entry of fs.readdirSync(full))visit(path.join(rel,entry));return;}if(!stat.isFile())return;const ext=path.extname(rel).toLowerCase();if(rel.startsWith('native_backend/fixtures/') && !approvedNativeFixtures.has(path.basename(rel))){excluded.push(rel+' [non-release fixture]');return;}if((rel.startsWith('native_app/') && /\.(?:png|jpe?g|webp)$/i.test(rel)) || rel.startsWith('native_app/assets/')||rel.startsWith('public/avatars/guides/')){excluded.push(rel+' [local/review-pending asset]');return;}if(!allowedExt.has(ext)&&!files.includes(rel)){excluded.push(rel+' [type]');return;}const target=path.join(destination,rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(full,target);copied++;}
if(fs.existsSync(destination)){if(fs.readdirSync(destination).length)throw new Error('Destination must be empty; refusing to overwrite');}else fs.mkdirSync(destination,{recursive:true});
for(const f of [...files,...top,...safeDocs])visit(f);
const inventory={generated:new Date().toISOString(),source:'private-local-workspace',destination:'unpublished-public-candidate',copied,excluded,notice:'CANDIDATE ONLY. Not yet reviewed for licensing, secrets, PII, history or binary redistribution. Do not publish automatically.'};
fs.writeFileSync(path.join(destination,'PUBLIC_CANDIDATE_INVENTORY.json'),JSON.stringify(inventory,null,2));
console.log(`Candidate: ${destination}\nCopied ${copied} files; excluded ${excluded.length} paths. NOT cleared for publication.`);

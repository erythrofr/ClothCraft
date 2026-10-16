#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();const violations=[];const skip=new Set(['node_modules','.git','.npm-cache']);
function walk(dir){if(!fs.existsSync(dir))return;for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(skip.has(ent.name))continue;const rel=path.relative(root,path.join(dir,ent.name));if(ent.isSymbolicLink()){violations.push('symlink: '+rel);continue;}if(ent.isDirectory()){walk(path.join(dir,ent.name));continue;}if(/thomas/i.test(ent.name)||/\.(pem|key|p12|pfx|safetensors|onnx|pt|pth)$/i.test(ent.name)||/^\.env(?:\.|$)/.test(ent.name))violations.push('prohibited filename: '+rel);}}
for(const dir of ['src','public','native_app','native_backend','blender_bridge','integrations','dist'])walk(path.join(root,dir));
for(const file of ['LICENSE','README.md','CONTRIBUTING.md','SECURITY.md','index.html'])if(!fs.existsSync(path.join(root,file)))violations.push('missing required file: '+file);
if(violations.length){console.error('PUBLIC RELEASE GATE FAILED:\n'+violations.join('\n'));process.exit(1);}console.log('Public source filename gate passed (not a complete license/security audit).');

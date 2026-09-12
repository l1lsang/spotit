import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const root=path.dirname(fileURLToPath(import.meta.url));
const globals=path.join(root,'plugin-globals.d.ts');
fs.writeFileSync(globals,'declare const figma: PluginAPI;\ndeclare const SPEC: any;\ndeclare const ICONS: Record<string,string>;\ndeclare const PHOTO_BASE64: Record<string,string>;\n');
const api='C:/Users/jkm08/.codex/plugins/cache/openai-curated-remote/figma/2.0.21/skills/figma-use/references/plugin-api-standalone.d.ts';
const program=ts.createProgram([path.join(root,'figma-plugin/source.js'),globals,api],{allowJs:true,checkJs:true,noEmit:true,skipLibCheck:true,target:ts.ScriptTarget.ES2021,types:[],strict:false});
const errors=ts.getPreEmitDiagnostics(program).filter(d=>d.category===ts.DiagnosticCategory.Error);
for(const d of errors){const lc=d.file?.getLineAndCharacterOfPosition(d.start);console.log(`${lc?lc.line+1:0}: ${ts.flattenDiagnosticMessageText(d.messageText,' ')}`);}
if(errors.length)process.exitCode=1;else console.log('Figma Plugin API type check passed.');

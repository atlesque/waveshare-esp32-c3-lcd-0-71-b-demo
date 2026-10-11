import fs from 'node:fs';
const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
const server=fs.readFileSync(new URL('./server.mjs',import.meta.url),'utf8').replace("import { HTML } from './page.mjs';",'const HTML = '+JSON.stringify(html)+';');
fs.writeFileSync(new URL('./worker.js',import.meta.url),server);

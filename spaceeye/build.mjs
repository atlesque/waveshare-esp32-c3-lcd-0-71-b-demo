import fs from 'node:fs';
const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
const physics=fs.readFileSync(new URL('./physics.mjs',import.meta.url),'utf8').replace(/^export /gm,'');
const simulation=fs.readFileSync(new URL('./simulation.mjs',import.meta.url),'utf8').replaceAll('export ', '').replace("import { advanceShips, wrapShip } from './physics.mjs';", physics);
const server=fs.readFileSync(new URL('./server.mjs',import.meta.url),'utf8').replace("import { newWorld, newShip, advanceWorld, fireAction } from './simulation.mjs';",simulation).replace("import { HTML } from './page.mjs';",'const HTML = '+JSON.stringify(html)+';');
fs.writeFileSync(new URL('./worker.js',import.meta.url),server);

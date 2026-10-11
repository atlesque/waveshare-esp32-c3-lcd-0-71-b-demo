import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import assert from 'node:assert/strict';
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:new URL('./worker.js',import.meta.url).pathname,compatibilityDate:'2026-10-11',durableObjects:{ROOM:{className:'SpaceRoom',useSQLite:true}}}));
const base='http://localhost';
const clients=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function connect(path='/ws'){const r=await mf.dispatchFetch(base+path,{headers:{Upgrade:'websocket',Origin:base}});assert.equal(r.status,101);const ws=r.webSocket;const messages=[];ws.accept();ws.addEventListener('message',e=>messages.push(JSON.parse(e.data)));clients.push({ws,messages});return clients.at(-1)}
async function wait(c,type){for(let i=0;i<100;i++){const index=c.messages.findIndex(m=>m.type===type);if(index>=0)return c.messages.splice(index,1)[0];await delay(10)}throw Error('Missing '+type)}
try{
 assert.equal((await mf.dispatchFetch(base+'/health')).status,200);
 assert.equal((await mf.dispatchFetch(base+'/ws',{headers:{Upgrade:'websocket',Origin:'https://other.example'}})).status,403);
 const display=await connect('/ws?lcd=1');await wait(display,'welcome');
 const firstDisplayState=await wait(display,'state');assert.ok(firstDisplayState.lcdAt>0);
 await delay(50);display.ws.send(JSON.stringify({type:'ping'}));
 const refreshedDisplayState=await wait(display,'state');assert.equal(refreshedDisplayState.type,'state');
 assert.ok((await (await mf.dispatchFetch(base+'/state')).json()).lcdAt>firstDisplayState.lcdAt);
 assert.equal('lcdAt' in refreshedDisplayState,false,'LCD stream omits browser-only metadata');
 display.ws.close();clients.pop();await delay(50);
 for(let i=0;i<5;i++){const c=await connect();await wait(c,'welcome');c.ws.send(JSON.stringify({type:'join'}));const m=await wait(c,i===4?'error':'joined');if(i<4)assert.equal(m.slot,i)}
 let state=await (await mf.dispatchFetch(base+'/state')).json();assert.equal(state.ships.length,4);
 const start=state.ships.find(s=>s.slot===0);
 for(let i=0;i<8;i++){await delay(55);clients[0].ws.send(JSON.stringify({type:'input',thrust:true}));}
 await delay(60);state=await (await mf.dispatchFetch(base+'/state')).json();const moved=state.ships.find(s=>s.slot===0);assert.ok(Math.hypot(moved.x-start.x,moved.y-start.y)>1,'thrust moves ship');
 const lcd=await (await mf.dispatchFetch(base+'/lcd')).text();assert.ok(lcd.startsWith('SPACEYE1\n4\n'));assert.equal(lcd.trim().split('\n').length,6);
 clients[1].ws.send(JSON.stringify({type:'leave'}));await delay(70);clients[4].ws.send(JSON.stringify({type:'join'}));assert.equal((await wait(clients[4],'joined')).slot,1);
 clients[0].ws.send('not json');await delay(50);assert.equal((await mf.dispatchFetch(base+'/state')).status,200);
 const pilot = clients[0];
 pilot.ws.send(JSON.stringify({type:'action',action:'missile'}));
 assert.equal((await wait(pilot,'action')).accepted,true);
 let combat = await (await mf.dispatchFetch(base+'/state')).json();
 assert.ok(combat.projectiles.some(p=>p.kind===1));
 pilot.ws.send(JSON.stringify({type:'action',action:'missile'}));
 assert.equal((await wait(pilot,'action')).accepted,false,'server rejects repeated fire');
 pilot.ws.send(JSON.stringify({type:'action',action:'photon'}));
 assert.equal((await wait(pilot,'action')).accepted,true);
 const advancedLcd = await (await mf.dispatchFetch(base+'/lcd?v=2')).text();
 assert.ok(advancedLcd.startsWith('SPACEYE2\n4\n')); assert.ok(advancedLcd.length<=2048,'LCD payload stays bounded');
 assert.equal(advancedLcd.split('\n')[2].split(' ').length,8,'LCD ship fields include combat state');
 const beforeWarp = (await (await mf.dispatchFetch(base+'/state')).json()).ships.find(s=>s.slot===0);
 pilot.ws.send(JSON.stringify({type:'action',action:'warp'}));
 assert.equal((await wait(pilot,'action')).accepted,true);
 const afterWarp = (await (await mf.dispatchFetch(base+'/state')).json()).ships.find(s=>s.slot===0);
 assert.ok(Math.hypot(afterWarp.x-beforeWarp.x,afterWarp.y-beforeWarp.y)>10);
 assert.ok(afterWarp.cooldowns.warp>0);
 // An observer cannot launch weapons or acquire a pilot's warp state.
 clients[1].ws.send(JSON.stringify({type:'action',action:'warp'})); await delay(30);
 assert.equal(clients[1].messages.some(m=>m.type==='action'),false);
 pilot.ws.send(JSON.stringify({type:'input',gun:true})); await delay(65);
 pilot.ws.send(JSON.stringify({type:'input',gun:true})); await delay(65);
 assert.ok((await (await mf.dispatchFetch(base+'/state')).json()).ships.find(s=>s.slot===0).cooldowns.gun>0,'held gun input reaches server even at arena boundary');
 console.log('PASS: four-player limit, movement, LCD protocol, slot reuse, origin validation, malformed input, weapon actions/cooldowns, warp, combat LCD protocol, spectator controls');
}finally{for(const c of clients)c.ws.close();await mf.dispose()}

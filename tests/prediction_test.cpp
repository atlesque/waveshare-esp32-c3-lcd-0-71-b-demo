#include "../visual_demo/prediction.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>

static Ship ship(int slot,float x,float y,float vx=0){
  Ship s{};s.slot=slot;s.x=x;s.y=y;s.vx=vx;s.hp=100;return s;
}
int main(){
  Arena v;v.count=1;v.ships[0]=ship(0,80,80,20);
  predictArena(v,.1f);assert(v.ships[0].x>81.8f&&v.ships[0].x<82.1f);
  v.ships[0]=ship(0,143.8f,80,35);predictArena(v,.1f);
  assert(v.ships[0].x<25&&v.ships[0].vx>0);
  v.count=2;v.ships[0]=ship(0,76,80,20);v.ships[1]=ship(1,84,80,-20);
  predictArena(v,.05f);assert(v.ships[0].vx<0&&v.ships[1].vx>0);
  assert(hypotf(v.ships[0].x-v.ships[1].x,v.ships[0].y-v.ships[1].y)>=7.99f);
  v=Arena{};v.shotCount=3;
  for(int i=0;i<3;i++){v.shots[i]={};v.shots[i].kind=i;v.shots[i].x=80;v.shots[i].y=80;}
  predictArena(v,.1f);
  assert(fabsf(v.shots[0].x-89.5f)<.001f);
  assert(fabsf(v.shots[1].x-84.5f)<.001f);
  assert(fabsf(v.shots[2].x-83.2f)<.001f);
  v.count=1;v.ships[0]=ship(1,90,85);v.shots[1].target=1;
  predictArena(v,.1f);assert(v.shots[1].a>0&&v.shots[1].a<=.281f);
  v=Arena{};v.count=1;v.ships[0]=ship(1,90,80);v.shotCount=1;
  v.shots[0]={};v.shots[0].x=80;v.shots[0].y=80;predictArena(v,.2f);
  assert(v.shots[0].kind==-1&&v.ships[0].hp==100);
  v=Arena{};v.shotCount=1;v.shots[0]={};v.shots[0].x=149;v.shots[0].y=80;
  predictArena(v,.1f);assert(v.shots[0].kind==-1);
  v=Arena{};v.count=1;v.ships[0]=ship(0,80,80,20);Arena capped=v;
  predictArena(v,5);predictArena(capped,.25f);assert(v.ships[0].x==capped.ships[0].x);
  Arena old;old.count=1;old.packets=1;old.updated=1000;old.ships[0]=ship(0,80,80);old.ships[0].a=3.13f;
  Arena next=old;next.updated=1100;next.ships[0].a=-3.13f;estimateTurns(next,old);
  assert(next.ships[0].turn>0&&next.ships[0].turn<.3f);
  next.ships[0].warp=1;next.ships[0].turn=0;estimateTurns(next,old);assert(next.ships[0].turn==0);
  puts("Prediction: motion, wrap, collisions, projectiles, homing, visual hits, stale cap and angle continuity passed");
}

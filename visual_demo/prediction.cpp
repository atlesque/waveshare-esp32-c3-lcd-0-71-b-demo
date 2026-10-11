#include "prediction.h"
#include <math.h>
#include <algorithm>

static float angleDelta(float a) {
  // Parsed headings are normalized; avoid three soft-float trig calls per turn.
  while(a>3.14159265359f)a-=6.28318530718f;
  while(a<-3.14159265359f)a+=6.28318530718f;
  return a;
}
static void wrap(Ship &s) {
  float dx=s.x-80,dy=s.y-80,r=hypotf(dx,dy);
  if(r>64){float distance=fmodf(r+64,128)-64;s.x=80+dx/r*distance;s.y=80+dy/r*distance;}
}
void estimateTurns(Arena &next,const Arena &previous) {
  float dt=(next.updated-previous.updated)*.001f;
  if(!previous.packets||dt<.015f||dt>.5f)return;
  for(int i=0;i<next.count;i++)for(int j=0;j<previous.count;j++){
    Ship &s=next.ships[i];const Ship &old=previous.ships[j];
    if(s.slot==old.slot&&s.hp>0&&old.hp>0&&!s.warp){
      s.turn=std::max(-3.5f,std::min(3.5f,angleDelta(s.a-old.a)/dt));
    }
  }
}
void predictArena(Arena &v,float seconds) {
  // Extrapolate only a short interval. A stalled link must not invent an ongoing battle.
  seconds=std::max(0.f,std::min(.25f,seconds));
  int steps=std::max(1,(int)ceilf(seconds/.01f));float dt=seconds/steps;
  float shotCos[24]={},shotSin[24]={};
  for(int i=0;i<v.shotCount;i++)if(v.shots[i].kind>=0&&v.shots[i].kind!=1){
    shotCos[i]=cosf(v.shots[i].a);shotSin[i]=sinf(v.shots[i].a);
  }
  for(int n=0;n<steps;n++){
    for(int i=0;i<v.count;i++){
      Ship &s=v.ships[i];if(s.hp<=0)continue;
      s.a+=s.turn*dt;float damping=expf(-.65f*dt);
      s.vx=(s.vx+cosf(s.a)*(s.thrust?30:0)*dt)*damping;
      s.vy=(s.vy+sinf(s.a)*(s.thrust?30:0)*dt)*damping;
      float speed=hypotf(s.vx,s.vy);if(speed>35){s.vx*=35/speed;s.vy*=35/speed;}
      s.x+=s.vx*dt;s.y+=s.vy*dt;wrap(s);
    }
    for(int pass=0;pass<4;pass++)for(int i=0;i<v.count;i++)for(int j=i+1;j<v.count;j++){
      Ship &a=v.ships[i],&b=v.ships[j];if(a.hp<=0||b.hp<=0)continue;
      float dx=b.x-a.x,dy=b.y-a.y,r=hypotf(dx,dy);if(r>=8)continue;
      float rx=b.vx-a.vx,ry=b.vy-a.vy,speed=hypotf(rx,ry);
      float nx=r>1e-6f?dx/r:(speed>1e-6f?-rx/speed:1);
      float ny=r>1e-6f?dy/r:(speed>1e-6f?-ry/speed:0);
      float correction=(8-r+.00001f)*.5f;
      a.x-=nx*correction;a.y-=ny*correction;b.x+=nx*correction;b.y+=ny*correction;
      float approach=rx*nx+ry*ny;
      if(approach<0){float impulse=-1.85f*approach*.5f;a.vx-=impulse*nx;a.vy-=impulse*ny;b.vx+=impulse*nx;b.vy+=impulse*ny;}
      wrap(a);wrap(b);
    }
    for(int i=0;i<v.shotCount;i++){
      Projectile &p=v.shots[i];if(p.kind<0)continue;
      if(p.kind==1){
        const Ship *target=nullptr;float nearest=1e9f;
        for(int j=0;j<v.count;j++){
          const Ship &s=v.ships[j];if(s.slot==p.owner||s.hp<=0)continue;
          float r=hypotf(s.x-p.x,s.y-p.y);
          if(s.slot==p.target){target=&s;break;}
          if(r<nearest){nearest=r;target=&s;}
        }
        if(target){float delta=angleDelta(atan2f(target->y-p.y,target->x-p.x)-p.a);p.a+=std::max(-2.8f*dt,std::min(2.8f*dt,delta));}
      }
      const float speeds[]={95,45,32};float x=p.x,y=p.y;
      float ca=p.kind==1?cosf(p.a):shotCos[i],sa=p.kind==1?sinf(p.a):shotSin[i];
      p.x+=ca*speeds[p.kind]*dt;p.y+=sa*speeds[p.kind]*dt;
      bool hit=false;
      for(int j=0;j<v.count;j++){
        const Ship &s=v.ships[j];if(s.slot==p.owner||s.hp<=0||s.shield)continue;
        float dx=p.x-x,dy=p.y-y,length=dx*dx+dy*dy;
        float u=length>0?std::max(0.f,std::min(1.f,((s.x-x)*dx+(s.y-y)*dy)/length)):0;
        if(hypotf(s.x-x-u*dx,s.y-y-u*dy)<5+p.kind)hit=true;
      }
      // Visual collision only: health, kills and new shots always come from the server.
      if(hit||hypotf(p.x-80,p.y-80)>70)p.kind=-1;
    }
  }
}

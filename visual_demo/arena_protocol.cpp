#include "arena_protocol.h"
#include <errno.h>
#include <math.h>
#include <stdlib.h>
#include <string.h>

namespace {
bool whitespace(char c) { return c==' ' || c=='\n' || c=='\r' || c=='\t'; }
struct Reader {
  const char *p;
  bool integer(int &value, int low, int high) {
    char *end; errno=0;
    long parsed=strtol(p,&end,10);
    if(end==p || (*end&&!whitespace(*end)) || errno || parsed<low || parsed>high) return false;
    value=int(parsed); p=end; return true;
  }
  bool number(float &value, float low, float high) {
    char *end; errno=0;
    float parsed=strtof(p,&end);
    if(end==p || (*end&&!whitespace(*end)) || errno || !isfinite(parsed) || parsed<low || parsed>high) return false;
    value=parsed; p=end; return true;
  }
  bool angle(float &value) {
    // Headings may accumulate on the server; normalize before drawing.
    if(!number(value,-1e6f,1e6f)) return false;
    value=fmodf(value,6.28318530718f); return true;
  }
  bool done() { while(whitespace(*p)) ++p; return *p=='\0'; }
};
}

bool parseArena(const char *body, size_t length, Arena &next) {
  if(!body || length<9 || length>MAX_ARENA_BODY || body[length-1]!='\n' || memchr(body,'\0',length)) return false;
  bool combat=memcmp(body,"SPACEYE2\n",9)==0;
  if(!combat && memcmp(body,"SPACEYE1\n",9)!=0) return false;
  Arena parsed;
  Reader r{body+9}; bool seen[4]={};
  if(!r.integer(parsed.count,0,4)) return false;
  for(int i=0;i<parsed.count;++i) {
    Ship &s=parsed.ships[i];
    if(!r.integer(s.slot,0,3) || seen[s.slot] || !r.number(s.x,10,150) || !r.number(s.y,10,150) || !r.angle(s.a) || !r.integer(s.thrust,0,1)) return false;
    seen[s.slot]=true;
    if(combat && (!r.integer(s.hp,0,100) || !r.integer(s.shield,0,1) || !r.integer(s.warp,0,1))) return false;
  }
  if(combat) {
    if(!r.integer(parsed.shotCount,0,24)) return false;
    for(int i=0;i<parsed.shotCount;++i) {
      Projectile &p=parsed.shots[i];
      if(!r.integer(p.kind,0,2) || !r.integer(p.owner,0,3) || !r.number(p.x,0,160) || !r.number(p.y,0,160) || !r.angle(p.a)) return false;
    }
    if(!r.integer(parsed.effectCount,0,8)) return false;
    for(int i=0;i<parsed.effectCount;++i) {
      Effect &e=parsed.effects[i];
      if(!r.integer(e.kind,0,3) || !r.integer(e.slot,0,3) || !r.number(e.x,0,160) || !r.number(e.y,0,160) || !r.number(e.age,0,1.5f)) return false;
    }
  }
  if(!r.done()) return false;
  next=parsed; return true;
}

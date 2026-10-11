#include "stream_protocol.h"
#include <ArduinoJson.h>
#include <stddef.h>
#include <string.h>
#include <math.h>

namespace {
// A fixed pool prevents per-message JSON allocations from fragmenting the TLS heap.
class JsonPool : public ArduinoJson::Allocator {
  struct alignas(max_align_t) Block { size_t size; };
  alignas(max_align_t) unsigned char bytes_[16384];
  size_t used_=0;
 public:
  void reset() { used_=0; }
  void *allocate(size_t size) override {
    const size_t alignment=alignof(max_align_t);
    if(size>sizeof(bytes_)-sizeof(Block)) return nullptr;
    size_t total=(size+sizeof(Block)+alignment-1)/alignment*alignment;
    if(total>sizeof(bytes_)-used_) return nullptr;
    auto *block=reinterpret_cast<Block *>(bytes_+used_);
    block->size=size; used_+=total; return block+1;
  }
  void deallocate(void *) override {}
  void *reallocate(void *ptr,size_t size) override {
    if(!ptr) return allocate(size);
    auto *block=static_cast<Block *>(ptr)-1;
    if(size<=block->size) return ptr;
    void *next=allocate(size);
    if(next) memcpy(next,ptr,block->size);
    return next;
  }
};
JsonPool pool;
bool integer(JsonVariantConst v,int &out,int low,int high) {
  if(!v.is<int>()) return false;
  out=v.as<int>(); return out>=low&&out<=high;
}
bool number(JsonVariantConst v,float &out,float low,float high) {
  if(!v.is<float>()) return false;
  out=v.as<float>(); return isfinite(out)&&out>=low&&out<=high;
}
bool flag(JsonVariantConst v,int &out) {
  if(!v.is<bool>()) return false;
  out=v.as<bool>(); return true;
}
bool angle(JsonVariantConst v,float &out) {
  if(!number(v,out,-1e6f,1e6f)) return false;
  out=fmodf(out,6.28318530718f); return true;
}
}

bool parseStreamArena(char *body,size_t length,Arena &next) {
  if(!body||!length||length>MAX_STREAM_BODY||memchr(body,'\0',length)) return false;
  pool.reset(); JsonDocument doc(&pool);
  if(deserializeJson(doc,body,length,DeserializationOption::NestingLimit(4))) return false;
  if(doc["type"]!="state") return false;
  JsonArrayConst ships=doc["ships"],shots=doc["projectiles"],effects=doc["effects"];
  if(ships.isNull()||shots.isNull()||effects.isNull()||ships.size()>4||shots.size()>24||effects.size()>8) return false;
  if(!doc["now"].is<double>()) return false;
  double now=doc["now"].as<double>();
  if(!isfinite(now)||now<0||now>1e15) return false;
  Arena parsed; bool seen[4]={};
  for(JsonVariantConst value:ships) {
    if(!value.is<JsonObjectConst>()) return false;
    JsonObjectConst row=value; Ship &s=parsed.ships[parsed.count++];
    if(!integer(row["slot"],s.slot,0,3)||seen[s.slot]||!number(row["x"],s.x,10,150)||!number(row["y"],s.y,10,150)||!angle(row["a"],s.a)||!number(row["vx"],s.vx,-50,50)||!number(row["vy"],s.vy,-50,50)||hypotf(s.vx,s.vy)>50||!integer(row["hp"],s.hp,0,100)||!flag(row["thrust"],s.thrust)||!flag(row["shield"],s.shield)||!flag(row["warp"],s.warp)) return false;
    seen[s.slot]=true;
  }
  for(JsonVariantConst value:shots) {
    if(!value.is<JsonObjectConst>()) return false;
    JsonObjectConst row=value; Projectile &p=parsed.shots[parsed.shotCount++];
    if(!integer(row["kind"],p.kind,0,2)||!integer(row["owner"],p.owner,0,3)||!integer(row["target"],p.target,-1,3)||!number(row["x"],p.x,0,160)||!number(row["y"],p.y,0,160)||!angle(row["a"],p.a)) return false;
  }
  for(JsonVariantConst value:effects) {
    if(!value.is<JsonObjectConst>()) return false;
    JsonObjectConst row=value; Effect &e=parsed.effects[parsed.effectCount++];
    if(!integer(row["kind"],e.kind,0,3)||!integer(row["slot"],e.slot,0,3)||!number(row["x"],e.x,0,160)||!number(row["y"],e.y,0,160)||!row["born"].is<double>()) return false;
    double born=row["born"].as<double>();
    if(!isfinite(born)||born<0||born>now) return false;
    e.age=float((now-born)*.001); if(e.age>1.5f) return false;
  }
  next=parsed; return true;
}

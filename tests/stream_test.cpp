#include "stream_protocol.h"
#include "stream_receiver.h"
#include <ArduinoJson.h>
#include <assert.h>
#include <string>
#include <vector>
#include <stdio.h>

bool parse(std::string input,Arena &a) { return parseStreamArena(input.data(),input.size(),a); }
std::vector<uint8_t> frame(uint8_t opcode,const std::string &s,bool final=true) {
  std::vector<uint8_t> result{uint8_t((final?128:0)|opcode)};
  if(s.size()<126) result.push_back(uint8_t(s.size()));
  else {result.push_back(126);result.push_back(uint8_t(s.size()>>8));result.push_back(uint8_t(s.size()));}
  result.insert(result.end(),s.begin(),s.end()); return result;
}
StreamReceiver::Event feed(StreamReceiver &r,const std::vector<uint8_t> &bytes,uint32_t now=10) {
  StreamReceiver::Event last=StreamReceiver::More;
  for(auto b:bytes) {last=r.feed(b,now);if(last==StreamReceiver::Error)break;}
  return last;
}
int main() {
  JsonDocument doc;
  doc["type"]="state";doc["now"]=1000000;
  JsonArray ships=doc["ships"].to<JsonArray>();
  for(int i=0;i<4;++i) {
    JsonObject row=ships.add<JsonObject>();row["slot"]=i;row["x"]=80;row["y"]=80;
    row["a"]=12.5;row["vx"]=20;row["vy"]=20;row["hp"]=100;
    row["thrust"]=true;row["shield"]=false;row["warp"]=false;
    row["cooldowns"]["gun"]=0;row["cooldowns"]["missile"]=0;row["cooldowns"]["photon"]=0;row["cooldowns"]["warp"]=0;
  }
  JsonArray shots=doc["projectiles"].to<JsonArray>();
  for(int i=0;i<24;++i) {
    JsonObject row=shots.add<JsonObject>();row["id"]=i;row["kind"]=i%3;row["owner"]=i%4;
    row["target"]=-1;row["x"]=80;row["y"]=80;row["a"]=1;row["until"]=1001000;
  }
  JsonArray effects=doc["effects"].to<JsonArray>();
  for(int i=0;i<8;++i) {
    JsonObject row=effects.add<JsonObject>();row["kind"]=i%4;row["slot"]=i%4;
    row["x"]=80;row["y"]=80;row["born"]=999500;
  }
  std::string full;serializeJson(doc,full);Arena a;
  assert(full.size()<MAX_STREAM_BODY);
  for(int i=0;i<10000;++i) assert(parse(full,a));
  assert(a.count==4&&a.shotCount==24&&a.effectCount==8);
  // Collision impulses can temporarily exceed the 35-unit integration speed cap.
  ships[0]["vx"]=40;ships[0]["vy"]=0;std::string collision;serializeJson(doc,collision);assert(parse(collision,a));
  ships[0]["vx"]=60;collision.clear();serializeJson(doc,collision);assert(!parse(collision,a));
  ships[0]["vx"]=20;ships[0]["vy"]=20;
  ships[0].remove("vx");std::string bad;serializeJson(doc,bad);
  a.packets=123;assert(!parse(bad,a)&&a.packets==123);
  ships[0]["vx"]=0;ships[0]["slot"]=1;bad.clear();serializeJson(doc,bad);assert(!parse(bad,a));
  ships[0]["slot"]=0;ships[0]["thrust"]="true";bad.clear();serializeJson(doc,bad);assert(!parse(bad,a));
  assert(!parse(full.substr(0,full.size()-2),a));assert(!parse(std::string(MAX_STREAM_BODY+1,'x'),a));
  // A small wire message with thousands of JSON values must fail within the fixed pool.
  std::string huge="{\"type\":\"state\",\"junk\":[";
  for(int i=0;i<3000;++i) huge+=(i?",0":"0");
  huge+="]}";assert(huge.size()<MAX_STREAM_BODY);assert(!parse(huge,a));
  assert(parse(full,a)); // Allocation failure must not poison the next parse.

  char text[MAX_STREAM_BODY+1];StreamReceiver r(text);
  assert(feed(r,frame(1,full))==StreamReceiver::Text);
  assert(std::string(text,r.textSize())==full);
  size_t split=full.size()/2;
  assert(feed(r,frame(1,full.substr(0,split),false))==StreamReceiver::More);
  assert(feed(r,frame(9,"ping"))==StreamReceiver::Ping);
  assert(r.controlSize()==4);
  assert(feed(r,frame(0,full.substr(split)))==StreamReceiver::Text);
  assert(std::string(text,r.textSize())==full);
  assert(feed(r,frame(1,std::string(MAX_STREAM_BODY,'x')))==StreamReceiver::Text);
  assert(text[MAX_STREAM_BODY]=='\0');
  StreamReceiver large(text);assert(feed(large,frame(1,std::string(MAX_STREAM_BODY+1,'x')))==StreamReceiver::Error);
  StreamReceiver mask(text);assert(feed(mask,{0x81,0x80})==StreamReceiver::Error);
  StreamReceiver control(text);assert(feed(control,frame(9,std::string(126,'x')))==StreamReceiver::Error);
  StreamReceiver orphan(text);assert(feed(orphan,frame(0,"x"))==StreamReceiver::Error);
  StreamReceiver binary(text);assert(feed(binary,frame(2,"x"))==StreamReceiver::Error);
  StreamReceiver stalled(text);feed(stalled,frame(1,"part",false),10);assert(stalled.timedOut(5011));
  StreamReceiver partial(text);partial.feed(0x81,10);assert(partial.timedOut(5011));
  for(int i=0;i<1000;++i) {assert(feed(r,frame(1,full))==StreamReceiver::Text);assert(parse(std::string(text,r.textSize()),a));}
  puts("Stream tests passed: 10,000 maximum-load parses, fixed-pool exhaustion/recovery, malformed data, fragmented frames, ping interleaving, bounds and timeouts");
}

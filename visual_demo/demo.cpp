#include <Arduino.h>
#include <TFT_eSPI.h>
#include <WiFi.h>
#include <NetworkClientSecure.h>
#include <HTTPClient.h>
#include <time.h>
#include <math.h>
#include "secrets.h"

extern const uint8_t rootBundleStart[] asm("_binary_x509_crt_bundle_start");
extern const uint8_t rootBundleEnd[] asm("_binary_x509_crt_bundle_end");
TFT_eSPI tft;
TFT_eSprite frame(&tft);
struct Ship { int slot; float x,y,a; int thrust; int hp=100,shield=0,warp=0; };
struct Projectile { int kind,owner; float x,y,a; };
struct Effect { int kind,slot; float x,y,age; };
struct Arena { Ship ships[4]; Projectile shots[24]; Effect effects[8]; int count=0,shotCount=0,effectCount=0; uint32_t updated=0; uint32_t packets=0; };
Arena arena;
SemaphoreHandle_t stateLock;
const uint16_t shipColors[]={0x777B,0xFDCF,0xBCFF,0xFBD3};

bool parseArena(const String &body,Arena &next) {
  bool combat=body.startsWith("SPACEYE2\n");
  if((!combat&&!body.startsWith("SPACEYE1\n"))||body.length()>2048)return false;
  int offset=9,used=0,count=0;
  if(sscanf(body.c_str()+offset,"%d%n",&count,&used)!=1||count<0||count>4)return false;
  offset+=used;next.count=count;bool seen[4]={false,false,false,false};
  for(int i=0;i<count;i++){
    Ship &s=next.ships[i];used=0;
    int fields=combat?sscanf(body.c_str()+offset,"%d %f %f %f %d %d %d %d%n",&s.slot,&s.x,&s.y,&s.a,&s.thrust,&s.hp,&s.shield,&s.warp,&used)
      :sscanf(body.c_str()+offset,"%d %f %f %f %d%n",&s.slot,&s.x,&s.y,&s.a,&s.thrust,&used);
    if(fields!=(combat?8:5))return false;
    if(s.slot<0||s.slot>3||seen[s.slot]||!isfinite(s.x)||!isfinite(s.y)||!isfinite(s.a)||s.x<10||s.x>150||s.y<10||s.y>150||s.hp<0||s.hp>100)return false;
    seen[s.slot]=true;offset+=used;
  }
  if(combat){
    used=0;if(sscanf(body.c_str()+offset,"%d%n",&next.shotCount,&used)!=1||next.shotCount<0||next.shotCount>24)return false;offset+=used;
    for(int i=0;i<next.shotCount;i++){
      Projectile &p=next.shots[i];used=0;
      if(sscanf(body.c_str()+offset,"%d %d %f %f %f%n",&p.kind,&p.owner,&p.x,&p.y,&p.a,&used)!=5||p.kind<0||p.kind>2||p.owner<0||p.owner>3||!isfinite(p.x)||!isfinite(p.y)||!isfinite(p.a)||p.x<0||p.x>160||p.y<0||p.y>160)return false;offset+=used;
    }
    used=0;if(sscanf(body.c_str()+offset,"%d%n",&next.effectCount,&used)!=1||next.effectCount<0||next.effectCount>8)return false;offset+=used;
    for(int i=0;i<next.effectCount;i++){
      Effect &e=next.effects[i];used=0;
      if(sscanf(body.c_str()+offset,"%d %d %f %f %f%n",&e.kind,&e.slot,&e.x,&e.y,&e.age,&used)!=5||e.kind<0||e.kind>3||e.slot<0||e.slot>3||!isfinite(e.x)||!isfinite(e.y)||!isfinite(e.age)||e.x<0||e.x>160||e.y<0||e.y>160||e.age<0||e.age>1.5)return false;offset+=used;
    }
  }
  next.updated=millis();return true;
}

void networkTask(void *) {
  WiFi.mode(WIFI_STA);WiFi.setAutoReconnect(true);WiFi.begin(SPACE_WIFI_SSID,SPACE_WIFI_PASSWORD);
  Serial.println("Spaceeye: connecting to Wi-Fi");
  configTime(0,0,"pool.ntp.org","time.cloudflare.com");
  NetworkClientSecure tls;
  tls.setCACertBundle(rootBundleStart,rootBundleEnd-rootBundleStart);
  tls.setHandshakeTimeout(8);
  HTTPClient http;http.setConnectTimeout(8000);http.setTimeout(5000);http.setReuse(true);
  bool announced=false;uint32_t reconnectAt=0;uint32_t errors=0;
  for(;;){
    if(WiFi.status()!=WL_CONNECTED){
      announced=false;
      if(millis()-reconnectAt>15000){reconnectAt=millis();WiFi.disconnect();WiFi.begin(SPACE_WIFI_SSID,SPACE_WIFI_PASSWORD);Serial.println("Spaceeye: retrying Wi-Fi");}
      vTaskDelay(pdMS_TO_TICKS(500));continue;
    }
    if(!announced){Serial.printf("Spaceeye Wi-Fi connected, IP=%s RSSI=%d\n",WiFi.localIP().toString().c_str(),WiFi.RSSI());announced=true;}
    if(time(nullptr)<1700000000){vTaskDelay(pdMS_TO_TICKS(500));continue;}
    if(!http.begin(tls,"https://spaceeye.atlesque.dev/lcd?v=2")){vTaskDelay(pdMS_TO_TICKS(2000));continue;}
    int code=http.GET();Arena next;
    if(code==200&&http.getSize()<=2048&&parseArena(http.getString(),next)){
      xSemaphoreTake(stateLock,portMAX_DELAY);next.packets=arena.packets+1;arena=next;xSemaphoreGive(stateLock);
      if(next.packets==1||next.packets%40==0)Serial.printf("Spaceeye sync: packets=%lu pilots=%d shots=%d effects=%d heap=%lu\n",(unsigned long)next.packets,next.count,next.shotCount,next.effectCount,(unsigned long)ESP.getFreeHeap());
      errors=0;
    }else{if(errors++%5==0){char detail[128];int sslCode=tls.lastError(detail,sizeof(detail));Serial.printf("Spaceeye sync failed: HTTP=%d TLS=%d %s RSSI=%d time=%ld\n",code,sslCode,detail,WiFi.RSSI(),(long)time(nullptr));}tls.stop();}
    http.end();vTaskDelay(pdMS_TO_TICKS(code==200?250:2000));
  }
}

void setup(){
  Serial.begin(115200);delay(1500);Serial.println("Starting display initialization");
  tft.init();tft.setRotation(0);tft.fillScreen(TFT_BLACK);frame.setColorDepth(16);
  if(!frame.createSprite(160,160)){Serial.println("ERROR framebuffer allocation");while(true)delay(1000);}
  stateLock=xSemaphoreCreateMutex();
  if(!stateLock||xTaskCreate(networkTask,"spaceeye-network",12288,nullptr,1,nullptr)!=pdPASS){Serial.println("ERROR network allocation");while(true)delay(1000);}
  frame.setTextDatum(MC_DATUM);Serial.println("Spaceeye ready: GC9D01 160x160, TLS verified, four pilots, combat protocol 2");
}

void loop(){
  uint32_t started=millis();Arena view;xSemaphoreTake(stateLock,portMAX_DELAY);view=arena;xSemaphoreGive(stateLock);
  bool online=view.updated&&started-view.updated<5000;
  frame.fillSprite(tft.color565(3,7,15));
  for(int i=0;i<45;i++){int x=(i*73+17)%160,y=(i*137+41)%160;if((x-80)*(x-80)+(y-80)*(y-80)<74*74)frame.drawPixel(x,y,tft.color565(45+(i%3)*25,65+(i%3)*25,95+(i%3)*25));}
  uint16_t grid=tft.color565(15,30,45);frame.drawCircle(80,80,23,grid);frame.drawCircle(80,80,46,grid);frame.drawCircle(80,80,65,grid);frame.drawCircle(80,80,74,online?tft.color565(30,83,82):grid);
  frame.fillCircle(80,80,2,tft.color565(55,110,120));
  if(online&&view.count){for(int i=0;i<view.count;i++){
    Ship s=view.ships[i];if(s.hp<=0)continue;uint16_t color=shipColors[s.slot];float ca=cosf(s.a),sa=sinf(s.a);
    int tipX=s.x+5*ca,tipY=s.y+5*sa,leftX=s.x-4*ca-3*sa,leftY=s.y-4*sa+3*ca,rightX=s.x-4*ca+3*sa,rightY=s.y-4*sa-3*ca;
    if(s.thrust)frame.drawLine(s.x-4*ca,s.y-4*sa,s.x-(7+started%3)*ca,s.y-(7+started%3)*sa,TFT_ORANGE);
    frame.fillTriangle(tipX,tipY,leftX,leftY,rightX,rightY,color);frame.drawPixel(s.x,s.y,TFT_WHITE);
    if(s.shield||s.warp)frame.drawCircle(s.x,s.y,s.warp?10:7,color);
    frame.drawFastHLine(s.x-4,s.y+7,8,grid);frame.drawFastHLine(s.x-4,s.y+7,8*s.hp/100,color);
  }}else{
    frame.setTextColor(TFT_CYAN);frame.drawString("SPACEYE",80,56,2);frame.setTextColor(TFT_WHITE);frame.drawString(online?"JOIN THE FLEET":"CONNECTING",80,77,1);
    frame.setTextColor(tft.color565(140,160,180));frame.drawString("spaceeye",80,96,2);frame.drawString(".atlesque.dev",80,113,1);
  }
  if(online){
    for(int i=0;i<view.shotCount;i++){
      Projectile p=view.shots[i];float ca=cosf(p.a),sa=sinf(p.a);
      uint16_t color=p.kind==2?TFT_MAGENTA:(p.kind==1?TFT_ORANGE:shipColors[p.owner]);
      if(p.kind==0)frame.drawLine(p.x-2*ca,p.y-2*sa,p.x+ca,p.y+sa,color);
      if(p.kind==1)frame.fillTriangle(p.x+3*ca,p.y+3*sa,p.x-2*ca-sa,p.y-2*sa+ca,p.x-2*ca+sa,p.y-2*sa-ca,color);
      if(p.kind==2){frame.drawCircle(p.x,p.y,3,color);frame.fillCircle(p.x,p.y,1,TFT_WHITE);}
    }
    for(int i=0;i<view.effectCount;i++){
      Effect e=view.effects[i];float age=e.age+(started-view.updated)/1000.0f;if(age>=1)continue;
      uint16_t color=e.kind==2?TFT_CYAN:(e.kind==3?TFT_MAGENTA:TFT_ORANGE);
      frame.drawCircle(e.x,e.y,2+age*(e.kind==3?18:10),color);
    }
  }
  frame.setTextColor(online?TFT_CYAN:TFT_ORANGE);char label[24];snprintf(label,sizeof(label),"%d/4  %s",online?view.count:0,online?"LIVE":(WiFi.status()==WL_CONNECTED?"SYNC":"WIFI"));frame.drawString(label,80,20,1);
  frame.pushSprite(0,0);static uint32_t lastLog=0;if(started-lastLog>10000){lastLog=started;Serial.printf("Spaceeye running: uptime=%lus pilots=%d online=%d frames OK\n",(unsigned long)(started/1000),view.count,online);}
  int elapsed=millis()-started;if(elapsed<33)delay(33-elapsed);
}

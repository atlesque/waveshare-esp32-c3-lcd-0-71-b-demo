#include <Arduino.h>
#include <TFT_eSPI.h>
#include <WiFi.h>
#include <NetworkClientSecure.h>
#include <time.h>
#include <math.h>
#include <esp_system.h>
#include "secrets.h"

extern const uint8_t rootBundleStart[] asm("_binary_x509_crt_bundle_start");
extern const uint8_t rootBundleEnd[] asm("_binary_x509_crt_bundle_end");
TFT_eSPI tft;
TFT_eSprite frame(&tft);
#include "prediction.h"
Arena arena;
SemaphoreHandle_t stateLock;
TaskHandle_t networkHandle;
const uint16_t shipColors[]={0x777B,0xFDCF,0xBCFF,0xFBD3};

// Small dirty tiles avoid sending full-width bands for a moving one-pixel shot.
// 400 bytes of hashes plus a 512-byte staging tile; no second framebuffer.
uint32_t tileHashes[100] = {};
uint32_t displayBytes = 0;
void pushChangedTiles(uint32_t now) {
  static uint32_t lastRefresh = 0;
  bool refresh = lastRefresh == 0 || now - lastRefresh >= 5000;
  const auto *pixels = static_cast<const uint16_t *>(frame.getPointer());
  uint16_t tile[16*16];
  bool oldSwap=tft.getSwapBytes();tft.setSwapBytes(false);
  for (int ty = 0; ty < 10; ++ty) for(int tx=0;tx<10;++tx) {
    uint32_t hash = 2166136261u;int index=ty*10+tx;
    for (int y=0;y<16;++y) for(int x=0;x<16;++x)
      hash=(hash^pixels[(ty*16+y)*160+tx*16+x])*16777619u;
    if (refresh || hash != tileHashes[index]) {
      for(int y=0;y<16;++y)memcpy(tile+y*16,pixels+(ty*16+y)*160+tx*16,32);
      tft.pushImage(tx*16,ty*16,16,16,tile);
      tileHashes[index]=hash;displayBytes+=sizeof(tile);
    }
  }
  tft.setSwapBytes(oldSwap);
  // Refresh also repairs any missed transfer or rare hash collision.
  if(refresh)lastRefresh=now;
}

void networkTask(void *);

void setup(){
  Serial.begin(115200);delay(1500);Serial.printf("Starting display initialization, reset=%d\n",int(esp_reset_reason()));
  tft.init();tft.setRotation(0);tft.fillScreen(TFT_BLACK);frame.setColorDepth(16);
  if(!frame.createSprite(160,160)){Serial.println("ERROR framebuffer allocation");while(true)delay(1000);}
  stateLock=xSemaphoreCreateMutex();
  if(!stateLock||xTaskCreate(networkTask,"spaceeye-network",12288,nullptr,1,&networkHandle)!=pdPASS){Serial.println("ERROR network allocation");while(true)delay(1000);}
  frame.setTextDatum(MC_DATUM);Serial.println("Spaceeye ready: GC9D01 160x160, TLS verified, four pilots, WebSocket / local prediction / changed tiles / 60 fps target");
}

void loop(){
  Arena view;xSemaphoreTake(stateLock,portMAX_DELAY);view=arena;xSemaphoreGive(stateLock);uint32_t started=millis();
  bool online=view.packets&&started-view.updated<5000;
  if(online)predictArena(view,(started-view.updated)*.001f);
  frame.fillSprite(tft.color565(3,7,15));
  for(int i=0;i<45;i++){int x=(i*73+17)%160,y=(i*137+41)%160;if((x-80)*(x-80)+(y-80)*(y-80)<74*74)frame.drawPixel(x,y,tft.color565(45+(i%3)*25,65+(i%3)*25,95+(i%3)*25));}
  uint16_t grid=tft.color565(15,30,45);frame.drawCircle(80,80,23,grid);frame.drawCircle(80,80,46,grid);frame.drawCircle(80,80,65,grid);frame.drawCircle(80,80,74,online?tft.color565(30,83,82):grid);
  frame.fillCircle(80,80,2,tft.color565(55,110,120));
  if(online&&view.count){for(int i=0;i<view.count;i++){
    Ship s=view.ships[i];if(s.hp<=0)continue;uint16_t color=shipColors[s.slot];float ca=cosf(s.a),sa=sinf(s.a);
    int tipX=s.x+5*ca,tipY=s.y+5*sa,leftX=s.x-4*ca-3*sa,leftY=s.y-4*sa+3*ca,rightX=s.x-4*ca+3*sa,rightY=s.y-4*sa-3*ca;
    if(s.thrust)frame.drawLine(s.x-4*ca,s.y-4*sa,s.x-(7+(started/100)%3)*ca,s.y-(7+(started/100)%3)*sa,TFT_ORANGE);
    frame.fillTriangle(tipX,tipY,leftX,leftY,rightX,rightY,color);frame.drawPixel(s.x,s.y,TFT_WHITE);
    if(s.shield||s.warp)frame.drawCircle(s.x,s.y,s.warp?10:7,color);
    frame.drawFastHLine(s.x-4,s.y+7,8,grid);frame.drawFastHLine(s.x-4,s.y+7,8*s.hp/100,color);
  }}else{
    frame.setTextColor(TFT_CYAN);frame.drawString("SPACEYE",80,56,2);frame.setTextColor(TFT_WHITE);frame.drawString(online?"JOIN THE FLEET":"CONNECTING",80,77,1);
    frame.setTextColor(tft.color565(140,160,180));frame.drawString("spaceeye",80,96,2);frame.drawString(".atlesque.dev",80,113,1);
  }
  if(online){
    for(int i=0;i<view.shotCount;i++){
      Projectile p=view.shots[i];if(p.kind<0)continue;float ca=cosf(p.a),sa=sinf(p.a);
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
  pushChangedTiles(started);
  static uint32_t lastLog=0,frames=0,renderMs=0;frames++;renderMs+=millis()-started;
  if(started-lastLog>=10000){
    Serial.printf("Spaceeye running: uptime=%lus pilots=%d online=%d fps=%.1f render=%.1fms spiBytes=%lu age=%lums heap=%lu minHeap=%lu netStack=%u\n",
      (unsigned long)(started/1000),view.count,online,frames*1000.f/(started-lastLog),renderMs/(float)frames,
      (unsigned long)displayBytes,(unsigned long)(started-view.updated),(unsigned long)ESP.getFreeHeap(),
      (unsigned long)ESP.getMinFreeHeap(),unsigned(uxTaskGetStackHighWaterMark(networkHandle)));
    lastLog=started;frames=renderMs=displayBytes=0;
  }
  int elapsed=millis()-started;if(elapsed<16)delay(16-elapsed);else delay(1);
}

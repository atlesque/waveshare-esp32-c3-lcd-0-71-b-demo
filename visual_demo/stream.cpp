#include <Arduino.h>
#include "stream_protocol.h"
#include "stream_receiver.h"
#include <WiFi.h>
#include <NetworkClientSecure.h>
#include <time.h>
#include <math.h>
#include <algorithm>
#include <mbedtls/sha1.h>
#include <mbedtls/base64.h>
#include "prediction.h"
#include "secrets.h"

extern Arena arena;
extern SemaphoreHandle_t stateLock;
extern const uint8_t rootBundleStart[] asm("_binary_x509_crt_bundle_start");
extern const uint8_t rootBundleEnd[] asm("_binary_x509_crt_bundle_end");
static char message[MAX_STREAM_BODY+1];
static char latestMessage[MAX_STREAM_BODY+1];
static bool readHeaderLine(NetworkClientSecure &tls,char *line,size_t capacity,uint32_t started){
  size_t used=0;
  while(tls.connected()&&millis()-started<8000){
    if(!tls.available()){vTaskDelay(pdMS_TO_TICKS(1));continue;}
    int c=tls.read();if(c<0)continue;
    if(c=='\n'){line[used]='\0';return true;}
    if(used>=capacity-1){Serial.println("Spaceeye upgrade: header line exceeds limit");return false;}
    line[used++]=char(c);
  }
  Serial.println("Spaceeye upgrade: header read timeout/disconnect");return false;
}

static bool sendFrame(NetworkClientSecure &tls,uint8_t opcode,const char *body,size_t length){
  if(length>125)return false;
  uint8_t packet[131];packet[0]=0x80|opcode;packet[1]=0x80|length;
  uint32_t mask=esp_random();memcpy(packet+2,&mask,4);
  for(size_t i=0;i<length;i++)packet[6+i]=body[i]^packet[2+i%4];
  return tls.write(packet,6+length)==6+length;
}
static bool connectStream(NetworkClientSecure &tls){
  // stop_ssl_socket clears the bundle attachment in Arduino core 3.3.2.
  tls.setCACertBundle(rootBundleStart,rootBundleEnd-rootBundleStart);
  if(!tls.connect("spaceeye.atlesque.dev",443)){char error[128];int code=tls.lastError(error,sizeof(error));Serial.printf("Spaceeye TLS connect failed: %d %s\n",code,error);return false;}
  tls.setNoDelay(true);tls.setTimeout(1500);
  uint8_t nonce[16];for(int i=0;i<16;i+=4){uint32_t value=esp_random();memcpy(nonce+i,&value,4);}
  unsigned char key[32],accept[32],digest[20];size_t length=0;
  mbedtls_base64_encode(key,sizeof(key),&length,nonce,sizeof(nonce));key[length]=0;
  String expected=String((char*)key)+"258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
  mbedtls_sha1((const unsigned char*)expected.c_str(),expected.length(),digest);
  mbedtls_base64_encode(accept,sizeof(accept),&length,digest,sizeof(digest));accept[length]=0;
  tls.printf("GET /ws?lcd=1 HTTP/1.1\r\nHost: spaceeye.atlesque.dev\r\nOrigin: https://spaceeye.atlesque.dev\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: %s\r\n\r\n",key);
  char headerLine[512];uint32_t started=millis();
  if(!readHeaderLine(tls,headerLine,sizeof(headerLine),started))return false;
  String line(headerLine);if(!line.startsWith("HTTP/1.1 101 ")){Serial.printf("Spaceeye upgrade status: %s\n",headerLine);return false;}
  bool accepted=false,upgrade=false,connection=false;size_t bytes=line.length();
  while(tls.connected()&&bytes<4096){
    if(!readHeaderLine(tls,headerLine,sizeof(headerLine),started))return false;
    line=headerLine;bytes+=line.length()+1;line.trim();
    if(line.isEmpty()){if(!(accepted&&upgrade&&connection))Serial.printf("Spaceeye upgrade rejected: accept=%d upgrade=%d connection=%d\n",accepted,upgrade,connection);return accepted&&upgrade&&connection;}
    int colon=line.indexOf(':');if(colon<0)return false;
    String name=line.substring(0,colon),value=line.substring(colon+1);name.toLowerCase();value.trim();
    if(name=="sec-websocket-accept")accepted=value==(char*)accept;
    value.toLowerCase();if(name=="upgrade")upgrade=value=="websocket";
    if(name=="connection")connection=value.indexOf("upgrade")>=0;
  }
  return false;
}
static bool publishState(char *body,size_t length){
  Arena next;if(!parseStreamArena(body,length,next)){static uint32_t rejected=0;if(rejected++%100==0)Serial.printf("Spaceeye state rejected: bytes=%u total=%lu\n",unsigned(length),(unsigned long)rejected);return false;}
  next.updated=millis();xSemaphoreTake(stateLock,portMAX_DELAY);
  next.packets=arena.packets+1;estimateTurns(next,arena);arena=next;xSemaphoreGive(stateLock);
  if(next.packets==1||next.packets%200==0)Serial.printf("Spaceeye stream: packets=%lu pilots=%d shots=%d heap=%lu minHeap=%lu largest=%lu stack=%u\n",(unsigned long)next.packets,next.count,next.shotCount,(unsigned long)ESP.getFreeHeap(),(unsigned long)ESP.getMinFreeHeap(),(unsigned long)ESP.getMaxAllocHeap(),unsigned(uxTaskGetStackHighWaterMark(nullptr)));
  return true;
}

// Incremental RFC 6455 receiver. Partial TLS reads never block the rendering task.
static void receiveStream(NetworkClientSecure &tls){
  StreamReceiver receiver(message);
  uint8_t incoming[512];
  uint32_t pingAt=0,lastState=millis(),lastPublish=0,coalesced=0;
  size_t pending=0;
  while(tls.connected()&&WiFi.status()==WL_CONNECTED){
    if(millis()-pingAt>=1000){pingAt=millis();if(!sendFrame(tls,1,"{\"type\":\"ping\"}",15))break;}
    if(millis()-lastState>15000||receiver.timedOut(millis())){Serial.printf("Spaceeye stream timeout: stateAge=%lu partial=%d\n",(unsigned long)(millis()-lastState),receiver.timedOut(millis()));break;}
    // Drain a bounded slice of incoming frames; keep only the newest complete
    // state. Rendering and TLS get CPU time even during continuous broadcasts.
    int budget=2048;uint32_t sliceAt=millis();
    while(budget>0&&millis()-sliceAt<4){
      int available=tls.available();if(available<=0)break;
      size_t count=std::min(size_t(available),std::min(sizeof(incoming),size_t(budget)));
      int read=tls.read(incoming,count);if(read<=0)break;budget-=read;
      for(int i=0;i<read;++i){
      switch(receiver.feed(incoming[i],millis())){
        case StreamReceiver::Error: Serial.println("Spaceeye stream: invalid/oversized frame");return;
        case StreamReceiver::Closed: return;
        case StreamReceiver::Ping:
          if(!sendFrame(tls,10,reinterpret_cast<const char *>(receiver.control()),receiver.controlSize()))return;
          break;
        case StreamReceiver::Text:
          if(pending)++coalesced;
          pending=receiver.textSize();memcpy(latestMessage,message,pending+1);break;
        default: break;
      }
      }
    }
    uint32_t now=millis();
    if(pending&&now-lastPublish>=33){
      if(publishState(latestMessage,pending))lastState=millis();
      pending=0;lastPublish=now;
    }
    vTaskDelay(pdMS_TO_TICKS(2));
  }
  Serial.printf("Spaceeye stream ended: coalesced=%lu heap=%lu\n",(unsigned long)coalesced,(unsigned long)ESP.getFreeHeap());
}

void networkTask(void *){
  WiFi.mode(WIFI_STA);WiFi.setAutoReconnect(true);WiFi.begin(SPACE_WIFI_SSID,SPACE_WIFI_PASSWORD);WiFi.setSleep(false);
  configTime(0,0,"pool.ntp.org","time.cloudflare.com");
  NetworkClientSecure tls;tls.setCACertBundle(rootBundleStart,rootBundleEnd-rootBundleStart);tls.setHandshakeTimeout(8);
  Serial.println("Spaceeye: connecting Wi-Fi, low latency mode");uint32_t reconnectAt=millis();
  for(;;){
    if(WiFi.status()!=WL_CONNECTED){
      if(millis()-reconnectAt>15000){reconnectAt=millis();WiFi.disconnect();WiFi.begin(SPACE_WIFI_SSID,SPACE_WIFI_PASSWORD);WiFi.setSleep(false);}
      vTaskDelay(pdMS_TO_TICKS(500));continue;
    }
    if(time(nullptr)<1700000000){vTaskDelay(pdMS_TO_TICKS(500));continue;}
    if(connectStream(tls)){Serial.printf("Spaceeye WebSocket connected RSSI=%d\n",WiFi.RSSI());receiveStream(tls);}
    else Serial.printf("Spaceeye stream connection failed RSSI=%d heap=%lu\n",WiFi.RSSI(),(unsigned long)ESP.getFreeHeap());
    tls.stop();vTaskDelay(pdMS_TO_TICKS(1000));
  }
}

#pragma once
#include "stream_protocol.h"
#include <stdint.h>

// Incremental, allocation-free RFC 6455 framing; storage belongs to the caller.
class StreamReceiver {
 public:
  enum Event { More, Text, Ping, Pong, Closed, Error };
  explicit StreamReceiver(char *text) : text_(text) {}
  Event feed(uint8_t byte,uint32_t now) {
    if(!headerUsed_) frameAt_=now;
    if(headerUsed_<headerSize_) {
      header_[headerUsed_++]=byte;
      if(headerUsed_==2) {
        final_=header_[0]&0x80; opcode_=header_[0]&15;
        if((header_[0]&0x70)||(header_[1]&0x80)||(header_[1]&127)==127) return Error;
        headerSize_=(header_[1]&127)==126?4:2;
      }
      if(headerUsed_<headerSize_) return More;
      remaining_=headerSize_==4?(size_t(header_[2])<<8)|header_[3]:header_[1]&127;
      if(opcode_>=8) {
        if(!final_||remaining_>125||(opcode_!=8&&opcode_!=9&&opcode_!=10)) return Error;
        controlSize_=0;
      } else {
        if(opcode_==1) { if(fragment_) return Error; total_=0; messageAt_=now; }
        else if(opcode_!=0||!fragment_) return Error;
        if(remaining_>MAX_STREAM_BODY-total_) return Error;
      }
    } else {
      if(opcode_>=8) control_[controlSize_++]=byte;
      else text_[total_++]=char(byte);
      --remaining_;
    }
    if(remaining_) return More;
    Event event=More;
    if(opcode_==8) event=Closed;
    else if(opcode_==9) event=Ping;
    else if(opcode_==10) event=Pong;
    else {
      fragment_=!final_;
      if(final_) { text_[total_]='\0'; textSize_=total_; total_=0; event=Text; }
    }
    headerUsed_=0; headerSize_=2; return event;
  }
  bool timedOut(uint32_t now) const {
    return (headerUsed_&&now-frameAt_>5000)||(fragment_&&now-messageAt_>5000);
  }
  size_t textSize() const { return textSize_; }
  const uint8_t *control() const { return control_; }
  size_t controlSize() const { return controlSize_; }
 private:
  char *text_;
  uint8_t header_[4]={},control_[125]={};
  size_t remaining_=0,total_=0,textSize_=0,controlSize_=0;
  int headerUsed_=0,headerSize_=2;
  uint8_t opcode_=0;
  bool final_=false,fragment_=false;
  uint32_t frameAt_=0,messageAt_=0;
};

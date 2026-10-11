#include "arena_protocol.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <string>
#include <random>

bool parse(const std::string &s, Arena &a) { return parseArena(s.c_str(),s.size(),a); }
int main() {
  Arena a;
  assert(parse("SPACEYE1\n1\n0 80 80 1 1\n",a));
  assert(a.count==1 && a.ships[0].hp==100 && a.shotCount==0);
  std::string full="SPACEYE2\n4\n";
  for(int i=0;i<4;++i) full+=std::to_string(i)+" 80 80 12.5 1 100 1 1\n";
  full+="24\n";
  for(int i=0;i<24;++i) full+="2 3 160 0 -3.14\n";
  full+="8\n";
  for(int i=0;i<8;++i) full+="3 3 0 160 1.5\n";
  assert(parse(full,a));
  assert(a.count==4 && a.shotCount==24 && a.effectCount==8 && fabs(a.ships[0].a)<6.284f);
  for(const std::string &bad : {
      "SPACEYE2\n5\n", "SPACEYE2\n0\n25\n", "SPACEYE2\n0\n0\n9\n",
      "SPACEYE2\n1\n0 nan 80 0 0 100 0 0\n0\n0\n",
      "SPACEYE2\n1\n0 80 80 inf 0 100 0 0\n0\n0\n",
      "SPACEYE2\n1\n0 80 80 0 2 100 0 0\n0\n0\n",
      "SPACEYE2\n2\n0 80 80 0 0 100 0 0\n0 80 80 0 0 100 0 0\n0\n0\n",
      "SPACEYE2\n999999999999999999999999999999\n", "SPACEYE2\n0\n0\n0\ntrailing" }) {
    a.count=3; a.packets=123;
    assert(!parse(bad,a));
    assert(a.count==3 && a.packets==123);
  }
  for(size_t n=0;n<full.size();++n) assert(!parse(full.substr(0,n),a));
  assert(!parse(std::string(2049,'x'),a));
  assert(!parse(std::string("SPACEYE2\n0\n0\n0\n\0hidden",22),a));

  std::mt19937 rng(42);
  for(int i=0;i<20000;++i) {
    std::string input="SPACEYE2\n";
    for(unsigned n=rng()%2200;n;--n) input.push_back(char(rng()%128));
    parse(input,a);
  }
  puts("Firmware tests passed: maximum combat load, malformed/truncated input, 20,000 malformed inputs");
}

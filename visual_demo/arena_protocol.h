#pragma once
#include <stddef.h>
#include <stdint.h>

constexpr size_t MAX_ARENA_BODY = 2048;
struct Ship { int slot; float x,y,a; float vx=0,vy=0,turn=0; int thrust; int hp=100,shield=0,warp=0; };
struct Projectile { int kind,owner; float x,y,a; int target=-1; };
struct Effect { int kind,slot; float x,y,age; };
struct Arena { Ship ships[4]; Projectile shots[24]; Effect effects[8]; int count=0,shotCount=0,effectCount=0; uint32_t updated=0; uint32_t packets=0; };

// Input must have a NUL terminator at body[length]. Failed parses leave next alone.
bool parseArena(const char *body, size_t length, Arena &next);

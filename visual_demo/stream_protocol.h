#pragma once
#include "arena_protocol.h"

constexpr size_t MAX_STREAM_BODY=8192;
// Parses bounded JSON using a fixed allocation pool. Failure leaves next alone.
bool parseStreamArena(char *body,size_t length,Arena &next);

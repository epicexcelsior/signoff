#ifndef PROOFREADY_WS2812_H
#define PROOFREADY_WS2812_H
#include <stdbool.h>
#include <stdint.h>
#define PR_WS2812_SYMBOLS 25
#define PR_WS2812_RESOLUTION_HZ 10000000
/* Durations use 0.1 us ticks. The final low symbol latches one GRB pixel. */
typedef struct {
  uint16_t first_ticks, second_ticks;
  bool first_high, second_high;
} pr_ws2812_symbol;
void pr_ws2812_frame(bool active, uint8_t brightness,
                     pr_ws2812_symbol out[PR_WS2812_SYMBOLS]);
#endif

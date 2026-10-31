#include "ws2812.h"

void pr_ws2812_frame(bool active, uint8_t brightness,
                     pr_ws2812_symbol out[PR_WS2812_SYMBOLS]) {
  /* Equal GRB channels emit white and avoid color-order ambiguity. */
  uint8_t channel = active ? brightness : 0;
  for (unsigned i = 0; i < 24; i++) {
    bool bit = (channel & (0x80u >> (i % 8))) != 0;
    out[i] = (pr_ws2812_symbol){.first_ticks = bit ? 9 : 3,
                                .second_ticks = bit ? 3 : 9,
                                .first_high = true,
                                .second_high = false};
  }
  /* 300 us also covers WS2812 variants with a 280 us reset minimum. */
  out[24] = (pr_ws2812_symbol){.first_ticks = 1500,
                               .second_ticks = 1500,
                               .first_high = false,
                               .second_high = false};
}

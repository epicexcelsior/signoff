#include "optical_output.h"
#include "sdkconfig.h"
#ifdef CONFIG_PROOFREADY_OPTICAL_ENABLED
#include "driver/gpio.h"
#ifdef CONFIG_PROOFREADY_OPTICAL_WS2812
#include "driver/rmt_tx.h"
#include "ws2812.h"
static rmt_channel_handle_t channel;
static rmt_encoder_handle_t encoder;
/* RMT owns this buffer until rmt_tx_wait_all_done returns. Dispatch is serial. */
static rmt_symbol_word_t frame[PR_WS2812_SYMBOLS];
static bool transmission_uncertain;
#endif
#endif

esp_err_t pr_optical_output_set(bool active) {
#ifdef CONFIG_PROOFREADY_OPTICAL_ENABLED
#ifdef CONFIG_PROOFREADY_OPTICAL_WS2812
  if (!channel || !encoder || transmission_uncertain)
    return ESP_ERR_INVALID_STATE;
  pr_ws2812_symbol symbols[PR_WS2812_SYMBOLS];
  pr_ws2812_frame(active, CONFIG_PROOFREADY_OPTICAL_BRIGHTNESS, symbols);
  for (unsigned i = 0; i < PR_WS2812_SYMBOLS; i++)
    frame[i] = (rmt_symbol_word_t){.level0 = symbols[i].first_high,
                                  .duration0 = symbols[i].first_ticks,
                                  .level1 = symbols[i].second_high,
                                  .duration1 = symbols[i].second_ticks};
  rmt_transmit_config_t config = {.loop_count = 0, .flags.eot_level = 0};
  esp_err_t status = rmt_transmit(channel, encoder, frame, sizeof(frame), &config);
  if (status != ESP_OK)
    return status;
  status = rmt_tx_wait_all_done(channel, 100);
  /* Do not mutate a buffer whose asynchronous transfer has not completed. */
  if (status != ESP_OK)
    transmission_uncertain = true;
  return status;
#else
#ifdef CONFIG_PROOFREADY_OPTICAL_ACTIVE_LOW
  active = !active;
#endif
  return gpio_set_level(CONFIG_PROOFREADY_OPTICAL_GPIO, active);
#endif
#else
  (void)active;
  return ESP_ERR_NOT_SUPPORTED;
#endif
}

esp_err_t pr_optical_output_init(void) {
#ifdef CONFIG_PROOFREADY_OPTICAL_ENABLED
  if (!GPIO_IS_VALID_OUTPUT_GPIO(CONFIG_PROOFREADY_OPTICAL_GPIO))
    return ESP_ERR_INVALID_ARG;
#ifdef CONFIG_PROOFREADY_OPTICAL_WS2812
  rmt_tx_channel_config_t config = {
      .clk_src = RMT_CLK_SRC_DEFAULT,
      .gpio_num = CONFIG_PROOFREADY_OPTICAL_GPIO,
      .mem_block_symbols = 48,
      .resolution_hz = PR_WS2812_RESOLUTION_HZ,
      .trans_queue_depth = 1,
  };
  esp_err_t status = rmt_new_tx_channel(&config, &channel);
  if (status != ESP_OK)
    return status;
  rmt_copy_encoder_config_t copy = {};
  status = rmt_new_copy_encoder(&copy, &encoder);
  if (status != ESP_OK)
    return status;
  status = rmt_enable(channel);
  if (status != ESP_OK)
    return status;
  return pr_optical_output_set(false);
#else
  gpio_config_t config = {.pin_bit_mask = 1ULL << CONFIG_PROOFREADY_OPTICAL_GPIO,
                          .mode = GPIO_MODE_OUTPUT,
                          .pull_up_en = GPIO_PULLUP_DISABLE,
                          .pull_down_en = GPIO_PULLDOWN_DISABLE,
                          .intr_type = GPIO_INTR_DISABLE};
  esp_err_t status = pr_optical_output_set(false);
  return status == ESP_OK ? gpio_config(&config) : status;
#endif
#else
  return ESP_ERR_NOT_SUPPORTED;
#endif
}

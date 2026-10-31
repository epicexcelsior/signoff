#pragma once

#include "esp_err.h"
#include <stddef.h>

// Call before ADC, Wi-Fi, or BLE initialization. Never erase storage on
// failure.
esp_err_t receipt_identity_init(void);
esp_err_t receipt_identity_sign(const char *message, char *signature,
                                size_t capacity);

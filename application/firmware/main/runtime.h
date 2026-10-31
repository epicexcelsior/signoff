#pragma once
#include "esp_err.h"
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
esp_err_t pr_runtime_init(void);
int pr_manifest(char *out, size_t capacity);
int pr_dispatch(const char *input, size_t length, char *output,
                size_t capacity);
void pr_boot_id(char output[17]);
esp_err_t pr_ble_init(void);

#ifndef PROOFREADY_OPTICAL_OUTPUT_H
#define PROOFREADY_OPTICAL_OUTPUT_H
#include "esp_err.h"
#include <stdbool.h>
esp_err_t pr_optical_output_init(void);
esp_err_t pr_optical_output_set(bool active);
#endif

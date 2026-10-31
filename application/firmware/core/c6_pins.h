#ifndef PROOFREADY_C6_PINS_H
#define PROOFREADY_C6_PINS_H
#include <stdbool.h>
/* Chip-level restrictions only. The carrier review can impose further limits. */
bool pr_c6_contact_gpio_allowed(int gpio);
bool pr_c6_optical_gpio_allowed(int gpio, bool ws2812);
#endif

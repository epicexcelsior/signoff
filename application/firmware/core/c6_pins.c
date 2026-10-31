#include "c6_pins.h"

bool pr_c6_contact_gpio_allowed(int gpio) {
  /* C6FH4 does not expose 10/11 or flash GPIOs. Preserve native USB and straps. */
  return gpio >= 0 && gpio <= 23 && gpio != 4 && gpio != 5 && gpio != 8 &&
         gpio != 9 && gpio != 10 && gpio != 11 && gpio != 12 && gpio != 13 &&
         gpio != 15;
}
bool pr_c6_optical_gpio_allowed(int gpio, bool ws2812) {
  /* GPIO8 is allowed only for the carrier-reviewed addressable onboard LED. */
  return pr_c6_contact_gpio_allowed(gpio) || (ws2812 && gpio == 8);
}

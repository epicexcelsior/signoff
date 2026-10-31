#include "esp_log.h"
#include "nvs_flash.h"
#include "receipt_identity.h"
#include "runtime.h"
void app_main(void) {
  // Never erase NVS to recover startup errors. It contains the pinned identity
  // and replay claims.
  if (nvs_flash_init() != ESP_OK || receipt_identity_init() != ESP_OK ||
      pr_runtime_init() != ESP_OK) {
    ESP_LOGE(
        "PROOFREADY",
        "Initialization failed. Identity and replay storage remain preserved.");
    return;
  }
  if (pr_ble_init() != ESP_OK)
    ESP_LOGE("PROOFREADY",
             "BLE initialization failed. No device operation started.");
}

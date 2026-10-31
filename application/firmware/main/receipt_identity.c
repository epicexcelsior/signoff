#include "receipt_identity.h"
#include "bootloader_random.h"
#include "esp_log.h"
#include "mbedtls/base64.h"
#include "psa/crypto.h"
#include <stdbool.h>
#include <stdio.h>
#include <string.h>

// PSA's default persistent backend stores this key in NVS. It is NOT a secure
// element.
#define RECEIPT_KEY_ID ((psa_key_id_t)0x4650)
#define RECEIPT_ALGORITHM PSA_ALG_ECDSA(PSA_ALG_SHA_256)

static const char *TAG = "RECEIPT_IDENTITY";
static bool s_ready;

esp_err_t receipt_identity_init(void) {
  bootloader_random_enable();
  psa_status_t status = psa_crypto_init();
  psa_key_attributes_t attributes = PSA_KEY_ATTRIBUTES_INIT;
  if (status == PSA_SUCCESS) {
    status = psa_get_key_attributes(RECEIPT_KEY_ID, &attributes);
    // The SDK maps a missing persistent key to INVALID_HANDLE at this API.
    // Storage and corruption errors remain errors. Never replace an existing
    // key.
    if (status == PSA_ERROR_INVALID_HANDLE) {
      psa_set_key_id(&attributes, RECEIPT_KEY_ID);
      psa_set_key_lifetime(&attributes, PSA_KEY_LIFETIME_PERSISTENT);
      psa_set_key_type(&attributes,
                       PSA_KEY_TYPE_ECC_KEY_PAIR(PSA_ECC_FAMILY_SECP_R1));
      psa_set_key_bits(&attributes, 256);
      psa_set_key_usage_flags(&attributes, PSA_KEY_USAGE_SIGN_MESSAGE);
      psa_set_key_algorithm(&attributes, RECEIPT_ALGORITHM);
      psa_key_id_t key;
      status = psa_generate_key(&attributes, &key);
      if (status == PSA_SUCCESS)
        ESP_LOGI(TAG, "Generated persistent receipt identity");
    } else if (status == PSA_SUCCESS &&
               (psa_get_key_type(&attributes) !=
                    PSA_KEY_TYPE_ECC_KEY_PAIR(PSA_ECC_FAMILY_SECP_R1) ||
                psa_get_key_bits(&attributes) != 256 ||
                psa_get_key_algorithm(&attributes) != RECEIPT_ALGORITHM ||
                psa_get_key_usage_flags(&attributes) !=
                    PSA_KEY_USAGE_SIGN_MESSAGE ||
                psa_get_key_lifetime(&attributes) !=
                    PSA_KEY_LIFETIME_PERSISTENT)) {
      status = PSA_ERROR_BAD_STATE;
    }
  }
  psa_reset_key_attributes(&attributes);
  uint8_t public_key[65];
  size_t length = 0;
  if (status == PSA_SUCCESS) {
    status = psa_export_public_key(RECEIPT_KEY_ID, public_key,
                                   sizeof(public_key), &length);
    if (status == PSA_SUCCESS &&
        (length != sizeof(public_key) || public_key[0] != 4)) {
      status = PSA_ERROR_BAD_STATE;
    }
  }
  bootloader_random_disable();
  if (status != PSA_SUCCESS) {
    ESP_LOGE(TAG,
             "Receipt identity unavailable (PSA %d). Storage is preserved.",
             (int)status);
    return ESP_FAIL;
  }
  char public_hex[131];
  for (size_t i = 0; i < length; i++)
    snprintf(public_hex + i * 2, 3, "%02x", public_key[i]);
  s_ready = true;
  // Only public material reaches the console. Pin it through a trusted USB
  // connection.
  ESP_LOGI(TAG, "P256_PUBLIC_KEY=%s", public_hex);
  return ESP_OK;
}

esp_err_t receipt_identity_sign(const char *message, char *signature,
                                size_t capacity) {
  // A P-256 signature is 64 raw r||s bytes, or 88 padded base64 characters.
  if (!s_ready || !message || !signature || capacity < 92)
    return ESP_ERR_INVALID_ARG;
  uint8_t raw[64];
  size_t length = 0;
  psa_status_t status = psa_sign_message(
      RECEIPT_KEY_ID, RECEIPT_ALGORITHM, (const uint8_t *)message,
      strlen(message), raw, sizeof(raw), &length);
  if (status != PSA_SUCCESS || length != sizeof(raw))
    return ESP_FAIL;
  memcpy(signature, "v3:", 3);
  size_t encoded = 0;
  if (mbedtls_base64_encode((uint8_t *)signature + 3, capacity - 3, &encoded,
                            raw, length) != 0 ||
      encoded != 88)
    return ESP_FAIL;
  signature[3 + encoded] = '\0';
  return ESP_OK;
}

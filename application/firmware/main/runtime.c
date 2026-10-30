#include "runtime.h"
#include "bootloader_random.h"
#include "cJSON.h"
#include "driver/gpio.h"
#include "esp_random.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nvs.h"
#include "proofready_secret.h"
#include "protocol.h"
#include "psa/crypto.h"
#include "receipt_identity.h"
#include "sdkconfig.h"
#include <inttypes.h>
#include <limits.h>
#include <stdatomic.h>
#include <stdio.h>
#include <string.h>

#if defined(CONFIG_PROOFREADY_OPTICAL_ENABLED) &&                              \
    CONFIG_PROOFREADY_OPTICAL_GPIO < 0
#error Select an explicitly reviewed optical GPIO
#endif
#if defined(CONFIG_PROOFREADY_CONTACT_ENABLED) &&                              \
    CONFIG_PROOFREADY_CONTACT_GPIO < 0
#error Select an explicitly reviewed contact GPIO
#endif

static char boot[17];
static char secret[129];
static bool optical_ready, contact_ready;
static nvs_handle_t storage;
static pr_claims claims;
static atomic_uint remaining_claims;
static int64_t epoch_offset;
static uint32_t uptime(void) {
  return (uint32_t)(esp_timer_get_time() / 1000000);
}
static uint32_t epoch(void) { return (uint32_t)(epoch_offset + uptime()); }
void pr_boot_id(char out[17]) { memcpy(out, boot, sizeof(boot)); }
static bool authorized(const pr_request *request) {
  if (strlen(secret) < 16)
    return false;
  char message[512];
  if (pr_auth_message(request, message, sizeof(message)) < 0)
    return false;
  psa_key_attributes_t attributes = PSA_KEY_ATTRIBUTES_INIT;
  psa_set_key_type(&attributes, PSA_KEY_TYPE_HMAC);
  psa_set_key_algorithm(&attributes, PSA_ALG_HMAC(PSA_ALG_SHA_256));
  psa_set_key_usage_flags(&attributes, PSA_KEY_USAGE_SIGN_MESSAGE);
  psa_key_id_t key = 0;
  if (psa_import_key(&attributes, (const uint8_t *)secret, strlen(secret),
                     &key) != PSA_SUCCESS)
    return false;
  uint8_t mac[32];
  size_t length = 0;
  psa_status_t status = psa_mac_compute(
      key, PSA_ALG_HMAC(PSA_ALG_SHA_256), (const uint8_t *)message,
      strlen(message), mac, sizeof(mac), &length);
  psa_destroy_key(key);
  psa_reset_key_attributes(&attributes);
  if (status != PSA_SUCCESS || length != 32)
    return false;
  char hex[65];
  for (size_t i = 0; i < 32; i++)
    snprintf(hex + 2 * i, 3, "%02x", mac[i]);
  unsigned difference = 0;
  for (size_t i = 0; i < 64; i++)
    difference |= (unsigned char)hex[i] ^ (unsigned char)request->token[i];
  return difference == 0;
}
static int error_response(const char *request_id, const char *code, char *out,
                          size_t capacity) {
  int count =
      snprintf(out, capacity,
               "{\"protocol\":\"capmesh/"
               "0.1\",\"request_id\":\"%s\",\"status\":\"error\",\"error\":{"
               "\"code\":\"%s\",\"message\":\"The original device operation "
               "did not complete. Do not repeat it automatically.\"}}",
               request_id, code);
  return count >= 0 && (size_t)count < capacity ? count : -1;
}
static int output_json(cJSON *document, char *out, size_t capacity) {
  bool ok = cJSON_PrintPreallocated(document, out, (int)capacity, false);
  cJSON_Delete(document);
  return ok ? (int)strlen(out) : -1;
}
esp_err_t pr_runtime_init(void) {
  uint8_t random[8];
  bootloader_random_enable();
  esp_fill_random(random, sizeof(random));
  bootloader_random_disable();
  for (size_t i = 0; i < sizeof(random); i++)
    snprintf(boot + i * 2, 3, "%02x", random[i]);
  esp_err_t status = nvs_open("proofready", NVS_READWRITE, &storage);
  if (status != ESP_OK)
    return status;
  size_t size = sizeof(claims);
  status = nvs_get_blob(storage, "claims", &claims, &size);
  if (status == ESP_ERR_NVS_NOT_FOUND) {
    memset(&claims, 0, sizeof(claims));
    claims.version = 1;
  } else if (status != ESP_OK || size != sizeof(claims) ||
             !pr_claims_valid(&claims))
    return ESP_FAIL;
  size = sizeof(secret);
  status = nvs_get_str(storage, "auth", secret, &size);
  if (status == ESP_ERR_NVS_NOT_FOUND &&
      proofready_initial_secret_length >= 16 &&
      proofready_initial_secret_length <= 128) {
    memcpy(secret, proofready_initial_secret, proofready_initial_secret_length);
    secret[proofready_initial_secret_length] = '\0';
    if (memchr(secret, '\0', proofready_initial_secret_length))
      return ESP_FAIL;
    if (nvs_set_str(storage, "auth", secret) != ESP_OK ||
        nvs_commit(storage) != ESP_OK)
      return ESP_FAIL;
  } else if (status == ESP_ERR_NVS_NOT_FOUND)
    secret[0] = '\0';
  else if (status != ESP_OK || size < 17 || size > sizeof(secret))
    return ESP_FAIL;
  // No GPIO is initialized by the default build. Profile review and explicit
  // pin selection are required.
#ifdef CONFIG_PROOFREADY_CONTACT_ENABLED
  if (!GPIO_IS_VALID_GPIO(CONFIG_PROOFREADY_CONTACT_GPIO))
    return ESP_ERR_INVALID_ARG;
  gpio_config_t input = {.pin_bit_mask = 1ULL << CONFIG_PROOFREADY_CONTACT_GPIO,
                         .mode = GPIO_MODE_INPUT,
                         .pull_up_en = GPIO_PULLUP_ENABLE,
                         .pull_down_en = GPIO_PULLDOWN_DISABLE,
                         .intr_type = GPIO_INTR_DISABLE};
  if (gpio_config(&input) != ESP_OK)
    return ESP_FAIL;
  contact_ready = true;
#endif
#ifdef CONFIG_PROOFREADY_OPTICAL_ENABLED
  if (!GPIO_IS_VALID_OUTPUT_GPIO(CONFIG_PROOFREADY_OPTICAL_GPIO))
    return ESP_ERR_INVALID_ARG;
#ifdef CONFIG_PROOFREADY_CONTACT_ENABLED
  if (CONFIG_PROOFREADY_OPTICAL_GPIO == CONFIG_PROOFREADY_CONTACT_GPIO)
    return ESP_ERR_INVALID_ARG;
#endif
  gpio_config_t output = {.pin_bit_mask = 1ULL
                                          << CONFIG_PROOFREADY_OPTICAL_GPIO,
                          .mode = GPIO_MODE_OUTPUT,
                          .pull_up_en = GPIO_PULLUP_DISABLE,
                          .pull_down_en = GPIO_PULLDOWN_DISABLE,
                          .intr_type = GPIO_INTR_DISABLE};
#ifdef CONFIG_PROOFREADY_OPTICAL_ACTIVE_LOW
  const bool idle_level = true;
#else
  const bool idle_level = false;
#endif
  // Set the output latch before enabling its GPIO output mode.
  if (gpio_set_level(CONFIG_PROOFREADY_OPTICAL_GPIO, idle_level) != ESP_OK ||
      gpio_config(&output) != ESP_OK)
    return ESP_FAIL;
  optical_ready = true;
#endif
  atomic_init(&remaining_claims, PR_CLAIMS - claims.count);
  return ESP_OK;
}
int pr_manifest(char *out, size_t capacity) {
  cJSON *document = cJSON_CreateObject();
  cJSON_AddStringToObject(document, "protocol", "capmesh/0.1");
  cJSON_AddStringToObject(document, "device_id", CONFIG_PROOFREADY_PROVIDER);
  cJSON_AddStringToObject(document, "boot_id", boot);
  cJSON_AddStringToObject(document, "firmware", "proof-of-ready-reference-v1");
  cJSON_AddBoolToObject(document, "authorization_provisioned",
                        strlen(secret) >= 16);
  cJSON_AddNumberToObject(document, "remaining_claims",
                          atomic_load(&remaining_claims));
  cJSON *capabilities = cJSON_AddArrayToObject(document, "capabilities");
  if (contact_ready && strlen(secret) >= 16) {
    cJSON *c = cJSON_CreateObject();
    cJSON_AddStringToObject(c, "id", "state.observe");
    cJSON_AddItemToArray(capabilities, c);
  }
  if (optical_ready && strlen(secret) >= 16) {
    cJSON *c = cJSON_CreateObject();
    cJSON_AddStringToObject(c, "id", "optical.emit");
    cJSON_AddNumberToObject(c, "half_symbol_ms", 250);
    cJSON_AddItemToArray(capabilities, c);
  }
  cJSON_AddStringToObject(document, "request_chunks",
                          "proof-of-ready/request-chunks/v1");
  cJSON_AddStringToObject(document, "receipt_pages",
                          "0000cb04-0000-1000-8000-00805f9b34fb");
  return output_json(document, out, capacity);
}
static int set_optical(void *unused, bool active) {
  (void)unused;
#ifdef CONFIG_PROOFREADY_OPTICAL_ENABLED
#ifdef CONFIG_PROOFREADY_OPTICAL_ACTIVE_LOW
  active = !active;
#endif
  return gpio_set_level(CONFIG_PROOFREADY_OPTICAL_GPIO, active) == ESP_OK ? 0
                                                                          : -1;
#else
  (void)active;
  return -1;
#endif
}
static int wait_symbol(void *context, uint32_t milliseconds) {
  TickType_t *last_wake = context;
  vTaskDelayUntil(last_wake, pdMS_TO_TICKS(milliseconds));
  return 0;
}
static int observe(const pr_request *request, uint32_t started, char *out,
                   size_t capacity) {
#ifdef CONFIG_PROOFREADY_CONTACT_ENABLED
  bool closed = gpio_get_level(CONFIG_PROOFREADY_CONTACT_GPIO) == 0;
  int stable = 1;
  for (int i = 1; i < 5; i++) {
    vTaskDelay(pdMS_TO_TICKS(10));
    if ((gpio_get_level(CONFIG_PROOFREADY_CONTACT_GPIO) == 0) == closed)
      stable++;
  }
  uint32_t completed = epoch();
  char sensor[24];
  snprintf(sensor, sizeof(sensor), "gpio%d-contact",
           CONFIG_PROOFREADY_CONTACT_GPIO);
  char message[512];
  int count = snprintf(message, sizeof(message),
                       "fieldproof-observation-v1|capmesh/"
                       "0.1|%s|%s|state.observe|demo-gate|%" PRIu32
                       "|gate.closed|%s|%d|%d|5|%" PRIu32 "|%" PRIu32,
                       request->request_id, request->provider, request->nonce,
                       sensor, closed ? 1 : 0, stable, started, completed);
  char signature[92];
  if (count < 0 || count >= (int)sizeof(message) ||
      receipt_identity_sign(message, signature, sizeof(signature)) != ESP_OK)
    return error_response(request->request_id, "SIGNING_FAILED", out, capacity);
  cJSON *doc = cJSON_CreateObject();
  cJSON_AddStringToObject(doc, "protocol", "capmesh/0.1");
  cJSON_AddStringToObject(doc, "request_id", request->request_id);
  cJSON_AddStringToObject(doc, "status", "success");
  cJSON_AddStringToObject(doc, "provider", request->provider);
  cJSON_AddStringToObject(doc, "capability", "state.observe");
  cJSON *parameters = cJSON_AddObjectToObject(doc, "parameters");
  cJSON_AddStringToObject(parameters, "location", "demo-gate");
  cJSON_AddNumberToObject(doc, "nonce", request->nonce);
  cJSON *result = cJSON_AddObjectToObject(doc, "result");
  cJSON_AddStringToObject(result, "metric", "gate.closed");
  cJSON_AddStringToObject(result, "sensor", sensor);
  cJSON_AddBoolToObject(result, "closed", closed);
  cJSON_AddNumberToObject(result, "stable_samples", stable);
  cJSON_AddNumberToObject(result, "total_samples", 5);
  cJSON_AddNumberToObject(doc, "started_at", started);
  cJSON_AddNumberToObject(doc, "completed_at", completed);
  cJSON_AddStringToObject(doc, "receipt_signature", signature);
  return output_json(doc, out, capacity);
#else
  (void)started;
  return error_response(request->request_id, "CONTACT_DISABLED", out, capacity);
#endif
}
int pr_dispatch(const char *input, size_t length, char *output,
                size_t capacity) {
  pr_request request;
  const char *error =
      pr_parse(input, length, CONFIG_PROOFREADY_PROVIDER, boot, &request);
  if (error)
    return error_response("unknown", error, output, capacity);
  if (!authorized(&request))
    return error_response(request.request_id, "UNAUTHORIZED", output, capacity);
  uint32_t current = epoch_offset ? epoch() : request.timestamp;
  if (!pr_time_valid(&request, current))
    return error_response(request.request_id, "AUTH_EXPIRED", output, capacity);
  if ((request.optical && !optical_ready) ||
      (!request.optical && !contact_ready))
    return error_response(request.request_id, "CAPABILITY_DISABLED", output,
                          capacity);
  pr_claims next = claims;
  int claim = pr_claim_request(&next, &request);
  if (claim)
    return error_response(request.request_id,
                          claim == -1 ? "REPLAY_DETECTED" : "REPLAY_CAPACITY",
                          output, capacity);
  // Commit the claim before any sample or emission. Crash and storage failure
  // never repeat an operation.
  if (nvs_set_blob(storage, "claims", &next, sizeof(next)) != ESP_OK ||
      nvs_commit(storage) != ESP_OK)
    return error_response(request.request_id, "CLAIM_STORAGE_FAILED", output,
                          capacity);
  claims = next;
  atomic_store(&remaining_claims, PR_CLAIMS - claims.count);
  if (!epoch_offset)
    epoch_offset = (int64_t)request.timestamp - uptime();
  uint32_t started = epoch();
  if (!request.optical)
    return observe(&request, started, output, capacity);
  TickType_t last_wake = xTaskGetTickCount();
  if (pr_emit(request.bits, set_optical, wait_symbol, &last_wake) != PR_SYMBOLS)
    return error_response(request.request_id, "EMISSION_FAILED", output,
                          capacity);
  uint32_t completed = epoch();
  if (completed > request.expiration || completed < started + 17 ||
      completed > started + 20)
    return error_response(request.request_id, "EMISSION_TIMING_FAILED", output,
                          capacity);
  char message[512], signature[92];
  if (pr_receipt_message(&request, started, completed, message,
                         sizeof(message)) < 0 ||
      receipt_identity_sign(message, signature, sizeof(signature)) != ESP_OK)
    return error_response(request.request_id, "SIGNING_FAILED", output,
                          capacity);
  cJSON *document = cJSON_CreateObject();
  cJSON_AddStringToObject(document, "protocol", PR_PROTOCOL);
  cJSON_AddStringToObject(document, "provider", request.provider);
  cJSON_AddStringToObject(document, "sensor", "optical-led");
  cJSON_AddStringToObject(document, "work_order_digest",
                          request.work_order_digest);
  cJSON_AddStringToObject(document, "session_id", request.session_id);
  cJSON_AddStringToObject(document, "request_id", request.request_id);
  cJSON_AddNumberToObject(document, "nonce", request.nonce);
  cJSON_AddStringToObject(document, "bits", request.bits);
  cJSON_AddNumberToObject(document, "half_symbol_ms", 250);
  cJSON_AddNumberToObject(document, "started_at", started);
  cJSON_AddNumberToObject(document, "completed_at", completed);
  cJSON_AddNumberToObject(document, "symbol_count", PR_SYMBOLS);
  cJSON_AddStringToObject(document, "receipt_signature", signature);
  return output_json(document, output, capacity);
}

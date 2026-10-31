#include "protocol.h"
#include "cJSON.h"
#include <inttypes.h>
#include <math.h>
#include <stdio.h>
#include <string.h>

static bool text(const cJSON *item, size_t length, const char *alphabet) {
  return cJSON_IsString(item) && item->valuestring &&
         strlen(item->valuestring) == length &&
         strspn(item->valuestring, alphabet) == length;
}
static bool keys(const cJSON *object, const char *const names[], size_t count) {
  if (!cJSON_IsObject(object) || (size_t)cJSON_GetArraySize(object) != count)
    return false;
  for (const cJSON *item = object->child; item; item = item->next) {
    bool found = false;
    for (size_t n = 0; n < count; n++)
      if (strcmp(item->string, names[n]) == 0)
        found = true;
    if (!found)
      return false;
    for (const cJSON *other = item->next; other; other = other->next)
      if (strcmp(item->string, other->string) == 0)
        return false;
  }
  return true;
}
static uint32_t integer(const cJSON *item, uint32_t maximum) {
  if (!cJSON_IsNumber(item) || !isfinite(item->valuedouble) ||
      item->valuedouble < 1 || item->valuedouble > maximum ||
      floor(item->valuedouble) != item->valuedouble)
    return 0;
  return (uint32_t)item->valuedouble;
}
static const cJSON *get(const cJSON *object, const char *name) {
  return cJSON_GetObjectItemCaseSensitive(object, name);
}
const char *pr_parse(const char *json, size_t len, const char *provider,
                     const char *boot_id, pr_request *out) {
  const char *hex = "0123456789abcdef";
  const char *error = "INVALID_REQUEST";
  if (!json || !provider || !boot_id || !out || len == 0 ||
      len > PR_MAX_REQUEST || memchr(json, '\0', len))
    return error;
  char input[PR_MAX_REQUEST + 1];
  memcpy(input, json, len);
  input[len] = '\0';
  // cJSON strings are NUL-terminated. Reject encoded NUL rather than accepting
  // a truncated signed field.
  if (strstr(input, "\\u0000"))
    return error;
  cJSON *root = cJSON_ParseWithLengthOpts(input, len + 1, NULL, true);
  if (!root)
    return error;
  memset(out, 0, sizeof(*out));
  static const char *const names[] = {
      "protocol", "request_id", "device_id",  "capability",    "parameters",
      "nonce",    "timestamp",  "expiration", "authorization", "boot_id"};
  const cJSON *capability = get(root, "capability");
  if (!cJSON_IsString(capability))
    goto done;
  out->optical = strcmp(capability->valuestring, "optical.emit") == 0;
  if (!out->optical && strcmp(capability->valuestring, "state.observe") != 0) {
    error = "UNKNOWN_CAPABILITY";
    goto done;
  }
  size_t key_count = get(root, "boot_id") ? 10 : 9;
  if (!keys(root, names, key_count) || (out->optical && key_count != 10) ||
      !cJSON_IsString(get(root, "protocol")) ||
      strcmp(get(root, "protocol")->valuestring, "capmesh/0.1") ||
      !text(get(root, "request_id"), 16, hex) ||
      !cJSON_IsString(get(root, "device_id")) ||
      strcmp(get(root, "device_id")->valuestring, provider))
    goto done;
  if (key_count == 10 && (!text(get(root, "boot_id"), 16, hex) ||
                          strcmp(get(root, "boot_id")->valuestring, boot_id))) {
    error = "BOOT_MISMATCH";
    goto done;
  }
  strcpy(out->request_id, get(root, "request_id")->valuestring);
  if (strlen(provider) < 1 || strlen(provider) > 31 ||
      strspn(
          provider,
          "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-") !=
          strlen(provider))
    goto done;
  strcpy(out->provider, provider);
  strcpy(out->boot_id, boot_id);
  out->nonce = integer(get(root, "nonce"), 0x7fffffff);
  out->timestamp = integer(get(root, "timestamp"), UINT32_MAX - 45);
  out->expiration = integer(get(root, "expiration"), UINT32_MAX);
  if (!out->nonce || out->timestamp < 1700000000 ||
      out->expiration <= out->timestamp ||
      out->expiration - out->timestamp > (out->optical ? 45 : 30))
    goto done;
  const cJSON *authorization = get(root, "authorization");
  static const char *const auth_names[] = {"type", "token"};
  if (!keys(authorization, auth_names, 2) ||
      !cJSON_IsString(get(authorization, "type")) ||
      strcmp(get(authorization, "type")->valuestring,
             out->optical ? "proof-of-ready-optical-hmac-v1"
                          : "hmac-sha256-v2") ||
      !text(get(authorization, "token"), 64, hex)) {
    error = "UNAUTHORIZED";
    goto done;
  }
  strcpy(out->token, get(authorization, "token")->valuestring);
  const cJSON *parameters = get(root, "parameters");
  if (out->optical) {
    static const char *const parameter_names[] = {
        "work_order_digest", "session_id", "bits", "half_symbol_ms", "sensor"};
    const cJSON *digest = get(parameters, "work_order_digest");
    if (!keys(parameters, parameter_names, 5) || !cJSON_IsString(digest) ||
        strlen(digest->valuestring) != 66 ||
        strncmp(digest->valuestring, "0x", 2) ||
        strspn(digest->valuestring + 2, hex) != 64 ||
        !text(get(parameters, "session_id"), 16, hex) ||
        !text(get(parameters, "bits"), 8, hex) ||
        integer(get(parameters, "half_symbol_ms"), 250) != 250 ||
        !cJSON_IsString(get(parameters, "sensor")) ||
        strcmp(get(parameters, "sensor")->valuestring, "optical-led"))
      goto done;
    strcpy(out->work_order_digest, digest->valuestring);
    strcpy(out->session_id, get(parameters, "session_id")->valuestring);
    strcpy(out->bits, get(parameters, "bits")->valuestring);
  } else {
    static const char *const parameter_names[] = {"location"};
    if (!keys(parameters, parameter_names, 1) ||
        !cJSON_IsString(get(parameters, "location")) ||
        strcmp(get(parameters, "location")->valuestring, "demo-gate"))
      goto done;
  }
  error = NULL;
done:
  cJSON_Delete(root);
  return error;
}
bool pr_time_valid(const pr_request *request, uint32_t now) {
  if ((uint64_t)request->timestamp > (uint64_t)now + 2 ||
      now > request->expiration || now > request->timestamp + 30)
    return false;
  return !request->optical || request->expiration - now >= 19;
}
int pr_auth_message(const pr_request *r, char *out, size_t capacity) {
  int count;
  if (r->optical)
    count =
        snprintf(out, capacity,
                 "proof-of-ready-optical-auth-v1|%s|%s|%s|%s|%s|%s|250|%" PRIu32
                 "|%" PRIu32 "|%" PRIu32,
                 r->request_id, r->provider, r->boot_id, r->work_order_digest,
                 r->session_id, r->bits, r->nonce, r->timestamp, r->expiration);
  else
    count = snprintf(out, capacity,
                     "fieldproof-auth-v1|%s|%s|state.observe|demo-gate|%" PRIu32
                     "|%" PRIu32 "|%" PRIu32,
                     r->request_id, r->provider, r->nonce, r->timestamp,
                     r->expiration);
  return count >= 0 && (size_t)count < capacity ? count : -1;
}
int pr_receipt_message(const pr_request *r, uint32_t started,
                       uint32_t completed, char *out, size_t capacity) {
  int count =
      snprintf(out, capacity,
               "proof-of-ready-optical-v1|%s|optical-led|%s|%s|%s|%" PRIu32
               "|%s|250|%" PRIu32 "|%" PRIu32 "|72",
               r->provider, r->work_order_digest, r->session_id, r->request_id,
               r->nonce, r->bits, started, completed);
  return count >= 0 && (size_t)count < capacity ? count : -1;
}
bool pr_claims_valid(const pr_claims *claims) {
  if (claims->version != 1 || claims->count > PR_CLAIMS)
    return false;
  for (uint32_t i = 0; i < claims->count; i++) {
    if (memchr(claims->claims[i].request_id, '\0',
               sizeof(claims->claims[i].request_id)) !=
            claims->claims[i].request_id + 16 ||
        strspn(claims->claims[i].request_id, "0123456789abcdef") != 16 ||
        claims->claims[i].nonce == 0 || claims->claims[i].nonce > 0x7fffffff)
      return false;
    for (uint32_t n = 0; n < i; n++)
      if (claims->claims[i].nonce == claims->claims[n].nonce ||
          !strcmp(claims->claims[i].request_id, claims->claims[n].request_id))
        return false;
  }
  return true;
}
int pr_claim_request(pr_claims *claims, const pr_request *request) {
  if (!pr_claims_valid(claims))
    return -3;
  for (uint32_t i = 0; i < claims->count; i++)
    if (claims->claims[i].nonce == request->nonce ||
        !strcmp(claims->claims[i].request_id, request->request_id))
      return -1;
  if (claims->count == PR_CLAIMS)
    return -2;
  strcpy(claims->claims[claims->count].request_id, request->request_id);
  claims->claims[claims->count].nonce = request->nonce;
  claims->count++;
  return 0;
}
void pr_symbols(const char bits[9], uint8_t symbols[PR_SYMBOLS]) {
  static const uint8_t preamble[] = {0, 0, 0, 1, 1, 1, 0, 1};
  memcpy(symbols, preamble, 8);
  size_t offset = 8;
  for (size_t i = 0; i < 8; i++) {
    unsigned value = bits[i] <= '9' ? (unsigned)(bits[i] - '0')
                                    : (unsigned)(bits[i] - 'a' + 10);
    for (int bit = 3; bit >= 0; bit--) {
      bool one = (value & (1U << bit)) != 0;
      symbols[offset++] = one ? 1 : 0;
      symbols[offset++] = one ? 0 : 1;
    }
  }
}
int pr_emit(const char bits[9], int (*set_level)(void *, bool),
            int (*wait_ms)(void *, uint32_t), void *context) {
  uint8_t symbols[PR_SYMBOLS];
  pr_symbols(bits, symbols);
  for (size_t i = 0; i < PR_SYMBOLS; i++) {
    if (set_level(context, symbols[i] != 0) ||
        wait_ms(context, PR_HALF_SYMBOL_MS)) {
      set_level(context, false);
      return -1;
    }
  }
  return set_level(context, false) ? -1 : PR_SYMBOLS;
}

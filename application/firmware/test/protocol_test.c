#include "cJSON.h"
#include "protocol.h"
#include "transfer.h"
#include "ws2812.h"
#include "c6_pins.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>

static const char *original =
    "{\"protocol\":\"capmesh/"
    "0.1\",\"request_id\":\"abcdef1234567890\",\"device_id\":\"proof-ready-"
    "reference\",\"boot_id\":\"0000000000000000\",\"capability\":\"optical."
    "emit\",\"parameters\":{\"work_order_digest\":"
    "\"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\","
    "\"session_id\":\"1234567890abcdef\",\"bits\":\"8041fe03\",\"half_symbol_"
    "ms\":250,\"sensor\":\"optical-led\"},\"nonce\":123,\"timestamp\":"
    "1793368000,\"expiration\":1793368045,\"authorization\":{\"type\":\"proof-"
    "of-ready-optical-hmac-v1\",\"token\":"
    "\"fd8020f048edd10bc5b0c5921bad8b2ce10b490a7673066dba3e982e944e62c0\"}}";
static const char *parse(const char *json, pr_request *request) {
  return pr_parse(json, strlen(json), "proof-ready-reference",
                  "0000000000000000", request);
}
static int level(void *context, bool on) {
  int *count = context;
  (*count)++;
  return on && *count == 999 ? -1 : 0;
}
static int wait_ok(void *context, uint32_t milliseconds) {
  (void)context;
  assert(milliseconds == 250);
  return 0;
}
static int wait_error(void *context, uint32_t milliseconds) {
  (void)context;
  (void)milliseconds;
  return -1;
}
static void parser_tests(void) {
  pr_request request;
  assert(parse(original, &request) == NULL);
  assert(request.optical && request.nonce == 123);
  char message[512];
  assert(pr_auth_message(&request, message, sizeof(message)) > 0);
  assert(!strcmp(
      message, "proof-of-ready-optical-auth-v1|abcdef1234567890|proof-ready-"
               "reference|0000000000000000|"
               "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
               "aaa|1234567890abcdef|8041fe03|250|123|1793368000|1793368045"));
  assert(pr_receipt_message(&request, 1793368000, 1793368018, message,
                            sizeof(message)) > 0);
  assert(!strcmp(message,
                 "proof-of-ready-optical-v1|proof-ready-reference|optical-led|"
                 "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                 "aaaaa|1234567890abcdef|abcdef1234567890|123|8041fe03|250|"
                 "1793368000|1793368018|72"));
  assert(pr_auth_message(&request, message, 10) == -1);
  assert(pr_time_valid(&request, 1793368026));
  assert(!pr_time_valid(&request, 1793368027));
  assert(pr_time_valid(&request, 1793367998));
  assert(!pr_time_valid(&request, 1793367997));
  const char *bad_fields[] = {
      "protocol", "request_id", "device_id",  "boot_id",       "capability",
      "nonce",    "timestamp",  "expiration", "authorization", "parameters"};
  for (size_t i = 0; i < sizeof(bad_fields) / sizeof(bad_fields[0]); i++) {
    cJSON *root = cJSON_Parse(original);
    cJSON_DeleteItemFromObjectCaseSensitive(root, bad_fields[i]);
    char *json = cJSON_PrintUnformatted(root);
    assert(parse(json, &request) != NULL);
    cJSON_free(json);
    cJSON_Delete(root);
  }
  const char *bad_json[] = {
      "{}",
      "[]",
      "null",
      "true",
      "{\"capability\":\"optical.emit\",\"capability\":\"state.observe\"}",
      "{\"x\":\"\\u0000\"}",
      "{\"x\":[[[[[[[[[[[[[[[[[[1]]]]]]]]]]]]]]]]]]}"};
  for (size_t i = 0; i < sizeof(bad_json) / sizeof(bad_json[0]); i++)
    assert(parse(bad_json[i], &request) != NULL);
  cJSON *root = cJSON_Parse(original);
  cJSON_AddNumberToObject(root, "nonce", 123);
  char *json = cJSON_PrintUnformatted(root);
  assert(parse(json, &request) != NULL);
  cJSON_free(json);
  cJSON_Delete(root);
  root = cJSON_Parse(original);
  cJSON_ReplaceItemInObject(root, "nonce", cJSON_CreateNumber(1.5));
  json = cJSON_PrintUnformatted(root);
  assert(parse(json, &request) != NULL);
  cJSON_free(json);
  cJSON_Delete(root);
  root = cJSON_Parse(original);
  cJSON_ReplaceItemInObject(root, "expiration", cJSON_CreateNumber(1793368046));
  json = cJSON_PrintUnformatted(root);
  assert(parse(json, &request) != NULL);
  cJSON_free(json);
  cJSON_Delete(root);
  root = cJSON_Parse(original);
  cJSON *auth = cJSON_GetObjectItemCaseSensitive(root, "authorization");
  cJSON_ReplaceItemInObject(auth, "token", cJSON_CreateString("bad"));
  json = cJSON_PrintUnformatted(root);
  assert(!strcmp(parse(json, &request), "UNAUTHORIZED"));
  cJSON_free(json);
  cJSON_Delete(root);
  char embedded[PR_MAX_REQUEST + 1];
  memset(embedded, 'x', sizeof(embedded));
  embedded[30] = 0;
  assert(pr_parse(embedded, 40, "proof-ready-reference", "0000000000000000",
                  &request) != NULL);
  assert(pr_parse(embedded, PR_MAX_REQUEST + 1, "proof-ready-reference",
                  "0000000000000000", &request) != NULL);
  puts("PASS strict parsing, malformed authorization shape, exact wire vectors "
       "and time boundaries");
}
static void replay_tests(void) {
  pr_request request;
  assert(!parse(original, &request));
  pr_claims claims = {.version = 1};
  assert(pr_claim_request(&claims, &request) == 0);
  assert(pr_claim_request(&claims, &request) == -1);
  pr_claims restored;
  memcpy(&restored, &claims, sizeof(claims));
  assert(pr_claim_request(&restored, &request) == -1);
  request.nonce++;
  assert(pr_claim_request(&claims, &request) == -1);
  strcpy(request.request_id, "0000000000000001");
  request.nonce = 123;
  assert(pr_claim_request(&claims, &request) == -1);
  memset(&claims, 0, sizeof(claims));
  claims.version = 1;
  for (unsigned i = 0; i < PR_CLAIMS; i++) {
    snprintf(request.request_id, sizeof(request.request_id), "%016x", i + 1);
    request.nonce = i + 1;
    assert(pr_claim_request(&claims, &request) == 0);
  }
  strcpy(request.request_id, "ffffffffffffffff");
  request.nonce = 1000;
  assert(pr_claim_request(&claims, &request) == -2);
  memset(claims.claims[0].request_id, 'x', sizeof(claims.claims[0].request_id));
  assert(!pr_claims_valid(&claims));
  assert(pr_claim_request(&claims, &request) == -3);
  puts("PASS replay rejection, restored claims, exact capacity and corrupt "
       "storage fence");
}
static size_t frame(uint8_t *bytes, size_t total, size_t offset,
                    const char *data, size_t count) {
  bytes[0] = 'P';
  bytes[1] = 'R';
  bytes[2] = 1;
  bytes[3] = 0;
  bytes[4] = (uint8_t)(total >> 8);
  bytes[5] = (uint8_t)total;
  bytes[6] = (uint8_t)(offset >> 8);
  bytes[7] = (uint8_t)offset;
  memcpy(bytes + 8, data, count);
  return count + 8;
}
static void transfer_tests(void) {
  pr_transfer state = {0};
  uint8_t bytes[512];
  size_t total = strlen(original), offset = 0;
  assert(total > 512);
  while (offset < total) {
    size_t count = total - offset;
    if (count > 236)
      count = 236;
    size_t length = frame(bytes, total, offset, original + offset, count);
    int expected =
        offset + count == total ? PR_TRANSFER_COMPLETE : PR_TRANSFER_PARTIAL;
    assert(pr_transfer_write(&state, 1, 100, bytes, length) == expected);
    if (expected == PR_TRANSFER_PARTIAL)
      assert(pr_transfer_write(&state, 2, 101, bytes, length) ==
             PR_TRANSFER_BUSY);
    offset += count;
  }
  assert(state.busy && !strcmp(state.json, original));
  assert(pr_transfer_write(&state, 1, 100, bytes, 10) == PR_TRANSFER_BUSY);
  pr_transfer_disconnect(&state, 1);
  assert(state.busy);
  pr_transfer_release(&state);
  assert(!state.busy && !state.received);
  size_t length = frame(bytes, total, 0, original, 30);
  assert(pr_transfer_write(&state, 1, 100, bytes, length) == 0);
  assert(pr_transfer_write(&state, 1, 101, bytes, length) ==
         PR_TRANSFER_INVALID);
  assert(pr_transfer_write(&state, 2, 5101, bytes, length) == 0);
  pr_transfer_disconnect(&state, 1);
  assert(state.received);
  pr_transfer_disconnect(&state, 2);
  assert(!state.received);
  assert(pr_transfer_write(&state, 1, 1, (const uint8_t *)"{}", 2) == 1);
  pr_transfer_release(&state);
  length = frame(bytes, PR_MAX_REQUEST + 1, 0, original, 10);
  assert(pr_transfer_write(&state, 1, 1, bytes, length) == -1);
  length = frame(bytes, 30, 31, original, 10);
  assert(pr_transfer_write(&state, 1, 1, bytes, length) == -1);
  assert(pr_transfer_write(&state, 1, 1, bytes, 0) == -1);
  assert(pr_transfer_write(&state, 1, 1, bytes, 513) == -1);
  puts("PASS request fragmentation, concurrency, in-flight disconnect, "
       "timeout, offsets and size fences");
}
static void optical_tests(void) {
  uint8_t symbols[PR_SYMBOLS];
  pr_symbols("8041fe03", symbols);
  const uint8_t preamble[] = {0, 0, 0, 1, 1, 1, 0, 1};
  assert(!memcmp(symbols, preamble, 8));
  assert(symbols[8] == 1 && symbols[9] == 0);
  assert(symbols[10] == 0 && symbols[11] == 1);
  for (unsigned i = 8; i < PR_SYMBOLS; i += 2)
    assert(symbols[i] != symbols[i + 1]);
  int count = 0;
  assert(pr_emit("8041fe03", level, wait_ok, &count) == 72);
  assert(count == 73);
  count = 0;
  assert(pr_emit("8041fe03", level, wait_error, &count) == -1);
  assert(count == 2);
  puts("PASS Manchester vectors, complete emission accounting and failure "
       "cleanup");
}
static void ws2812_tests(void) {
  pr_ws2812_symbol symbols[PR_WS2812_SYMBOLS];
  for (unsigned brightness = 1; brightness <= 64; brightness++) {
    for (unsigned active = 0; active < 2; active++) {
      pr_ws2812_frame(active, brightness, symbols);
      for (unsigned channel = 0; channel < 3; channel++) {
        unsigned decoded = 0;
        for (unsigned bit = 0; bit < 8; bit++) {
          pr_ws2812_symbol pulse = symbols[channel * 8 + bit];
          assert(pulse.first_high && !pulse.second_high);
          assert(pulse.first_ticks + pulse.second_ticks == 12);
          assert(pulse.first_ticks == 3 || pulse.first_ticks == 9);
          decoded = (decoded << 1) | (pulse.first_ticks == 9);
        }
        assert(decoded == (active ? brightness : 0));
      }
      assert(!symbols[24].first_high && !symbols[24].second_high);
      assert(symbols[24].first_ticks + symbols[24].second_ticks == 3000);
    }
  }
  puts("PASS WS2812 complete GRB white/off vectors, bit order, timing and latch");
}
static void c6_pin_tests(void) {
  const int allowed[] = {0, 1, 2, 3, 6, 7, 14, 16, 17, 18, 19, 20, 21, 22, 23};
  for (int gpio = -1; gpio <= 48; gpio++) {
    bool expected = false;
    for (unsigned i = 0; i < sizeof(allowed) / sizeof(allowed[0]); i++)
      expected |= gpio == allowed[i];
    assert(pr_c6_contact_gpio_allowed(gpio) == expected);
    assert(pr_c6_optical_gpio_allowed(gpio, false) == expected);
    assert(pr_c6_optical_gpio_allowed(gpio, true) == (expected || gpio == 8));
  }
  puts("PASS C6FH4 strap, native USB, unexposed and flash GPIO rejection");
}
int main(void) {
  parser_tests();
  replay_tests();
  transfer_tests();
  optical_tests();
  ws2812_tests();
  c6_pin_tests();
  return 0;
}

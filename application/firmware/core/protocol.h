#ifndef PROOFREADY_PROTOCOL_H
#define PROOFREADY_PROTOCOL_H
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#define PR_MAX_REQUEST 1536
#define PR_MAX_RECEIPT 1536
#define PR_CLAIMS 64
#define PR_SYMBOLS 72
#define PR_HALF_SYMBOL_MS 250
#define PR_PROTOCOL "proof-of-ready/optical-execution/v1"
typedef struct {
  bool optical;
  char request_id[17], provider[32], boot_id[17], work_order_digest[67],
      session_id[17], bits[9], token[65];
  uint32_t nonce, timestamp, expiration;
} pr_request;
typedef struct {
  char request_id[17];
  uint32_t nonce;
} pr_claim;
typedef struct {
  uint32_t version, count;
  pr_claim claims[PR_CLAIMS];
} pr_claims;
const char *pr_parse(const char *json, size_t len, const char *provider,
                     const char *boot_id, pr_request *out);
bool pr_time_valid(const pr_request *request, uint32_t now);
int pr_auth_message(const pr_request *request, char *out, size_t capacity);
int pr_receipt_message(const pr_request *request, uint32_t started,
                       uint32_t completed, char *out, size_t capacity);
int pr_claim_request(pr_claims *claims, const pr_request *request);
bool pr_claims_valid(const pr_claims *claims);
void pr_symbols(const char bits[9], uint8_t symbols[PR_SYMBOLS]);
int pr_emit(const char bits[9], int (*set_level)(void *, bool),
            int (*wait_ms)(void *, uint32_t), void *context);
#endif

#ifndef PROOFREADY_TRANSFER_H
#define PROOFREADY_TRANSFER_H
#include "protocol.h"
#define PR_CHUNK_HEADER 8
#define PR_TRANSFER_TIMEOUT_MS 5000
// Call only while holding the transport lock. COMPLETE remains busy until
// release.
typedef struct {
  bool busy;
  uint16_t owner;
  size_t total, received;
  uint64_t updated_ms;
  char json[PR_MAX_REQUEST + 1];
} pr_transfer;
enum {
  PR_TRANSFER_INVALID = -1,
  PR_TRANSFER_BUSY = -2,
  PR_TRANSFER_PARTIAL = 0,
  PR_TRANSFER_COMPLETE = 1
};
int pr_transfer_write(pr_transfer *state, uint16_t owner, uint64_t now_ms,
                      const uint8_t *bytes, size_t length);
void pr_transfer_disconnect(pr_transfer *state, uint16_t owner);
void pr_transfer_release(pr_transfer *state);
#endif

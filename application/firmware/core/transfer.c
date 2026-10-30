#include "transfer.h"
#include <string.h>
void pr_transfer_release(pr_transfer *state) {
  memset(state, 0, sizeof(*state));
}
void pr_transfer_disconnect(pr_transfer *state, uint16_t owner) {
  // A dispatched operation survives disconnection. Only unfinished input is
  // discarded.
  if (!state->busy && state->received && state->owner == owner)
    pr_transfer_release(state);
}
int pr_transfer_write(pr_transfer *s, uint16_t owner, uint64_t now,
                      const uint8_t *data, size_t length) {
  if (s->busy)
    return PR_TRANSFER_BUSY;
  if (s->received && now - s->updated_ms > PR_TRANSFER_TIMEOUT_MS)
    pr_transfer_release(s);
  if (s->received && s->owner != owner)
    return PR_TRANSFER_BUSY;
  if (!length || length > 512)
    return PR_TRANSFER_INVALID;
  // Existing contact requests remain single UTF-8 JSON values.
  if (data[0] == '{') {
    if (s->received)
      return PR_TRANSFER_INVALID;
    memcpy(s->json, data, length);
    s->json[length] = '\0';
    s->total = s->received = length;
    s->owner = owner;
    s->busy = true;
    return PR_TRANSFER_COMPLETE;
  }
  // PR, version 1, reserved 0, total uint16 BE, offset uint16 BE, UTF-8 bytes.
  if (length <= PR_CHUNK_HEADER || data[0] != 'P' || data[1] != 'R' ||
      data[2] != 1 || data[3] != 0)
    return PR_TRANSFER_INVALID;
  size_t total = ((size_t)data[4] << 8) | data[5],
         offset = ((size_t)data[6] << 8) | data[7];
  size_t count = length - PR_CHUNK_HEADER;
  if (!total || total > PR_MAX_REQUEST || offset != s->received ||
      offset > total || count > total - offset ||
      (s->received && s->total != total))
    return PR_TRANSFER_INVALID;
  memcpy(s->json + offset, data + PR_CHUNK_HEADER, count);
  s->owner = owner;
  s->total = total;
  s->received += count;
  s->updated_ms = now;
  if (s->received != total)
    return PR_TRANSFER_PARTIAL;
  s->json[total] = '\0';
  s->busy = true;
  return PR_TRANSFER_COMPLETE;
}

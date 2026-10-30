#include "cJSON.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"
#include "freertos/task.h"
#include "host/ble_hs.h"
#include "host/ble_uuid.h"
#include "host/util/util.h"
#include "nimble/nimble_port.h"
#include "nimble/nimble_port_freertos.h"
#include "protocol.h"
#include "psa/crypto.h"
#include "runtime.h"
#include "services/gap/ble_svc_gap.h"
#include "services/gatt/ble_svc_gatt.h"
#include "transfer.h"
#include <stdio.h>
#include <string.h>

static const ble_uuid16_t service_uuid = BLE_UUID16_INIT(0xcb00),
                          manifest_uuid = BLE_UUID16_INIT(0xcb01),
                          invoke_uuid = BLE_UUID16_INIT(0xcb02),
                          receipt_uuid = BLE_UUID16_INIT(0xcb03),
                          pages_uuid = BLE_UUID16_INIT(0xcb04);
static uint16_t manifest_handle, invoke_handle, receipt_handle, pages_handle;
static uint8_t address_type;
static SemaphoreHandle_t lock;
static QueueHandle_t commands;
static pr_transfer transfer;
static char receipt[PR_MAX_RECEIPT] =
    "{\"protocol\":\"capmesh/0.1\",\"status\":\"idle\"}";
static char receipt_id[17];
static size_t page_offset;
typedef struct {
  size_t length;
  char json[PR_MAX_REQUEST + 1];
} command;
static int access_gatt(uint16_t connection, uint16_t attribute,
                       struct ble_gatt_access_ctxt *ctx, void *arg);
static const struct ble_gatt_svc_def services[] = {
    {.type = BLE_GATT_SVC_TYPE_PRIMARY,
     .uuid = &service_uuid.u,
     .characteristics =
         (struct ble_gatt_chr_def[]){
             {.uuid = &manifest_uuid.u,
              .access_cb = access_gatt,
              .flags = BLE_GATT_CHR_F_READ,
              .val_handle = &manifest_handle},
             {.uuid = &invoke_uuid.u,
              .access_cb = access_gatt,
              .flags = BLE_GATT_CHR_F_WRITE,
              .val_handle = &invoke_handle},
             {.uuid = &receipt_uuid.u,
              .access_cb = access_gatt,
              .flags = BLE_GATT_CHR_F_READ | BLE_GATT_CHR_F_NOTIFY,
              .val_handle = &receipt_handle},
             {.uuid = &pages_uuid.u,
              .access_cb = access_gatt,
              .flags = BLE_GATT_CHR_F_READ | BLE_GATT_CHR_F_WRITE,
              .val_handle = &pages_handle},
             {0}}},
    {0}};
static int append(struct ble_gatt_access_ctxt *ctx, const char *bytes,
                  size_t length) {
  return os_mbuf_append(ctx->om, bytes, length) == 0
             ? 0
             : BLE_ATT_ERR_INSUFFICIENT_RES;
}
static int access_gatt(uint16_t connection, uint16_t attribute,
                       struct ble_gatt_access_ctxt *ctx, void *arg) {
  (void)connection;
  (void)arg;
  if (attribute == manifest_handle && ctx->op == BLE_GATT_ACCESS_OP_READ_CHR) {
    char manifest[512];
    int length = pr_manifest(manifest, sizeof(manifest));
    return length > 0 ? append(ctx, manifest, length)
                      : BLE_ATT_ERR_INSUFFICIENT_RES;
  }
  if (attribute == invoke_handle && ctx->op == BLE_GATT_ACCESS_OP_WRITE_CHR) {
    uint8_t bytes[512];
    uint16_t length = 0;
    if (ble_hs_mbuf_to_flat(ctx->om, bytes, sizeof(bytes), &length) != 0 ||
        !length)
      return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
    xSemaphoreTake(lock, portMAX_DELAY);
    int status = pr_transfer_write(&transfer, connection,
                                   (uint64_t)(esp_timer_get_time() / 1000),
                                   bytes, length);
    if (status < 0) {
      xSemaphoreGive(lock);
      return status == PR_TRANSFER_BUSY ? BLE_ATT_ERR_INSUFFICIENT_RES
                                        : BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
    }
    if (status == PR_TRANSFER_PARTIAL) {
      xSemaphoreGive(lock);
      return 0;
    }
    command input = {.length = transfer.total};
    memcpy(input.json, transfer.json, transfer.total + 1);
    strcpy(receipt, "{\"protocol\":\"capmesh/0.1\",\"status\":\"pending\"}");
    receipt_id[0] = '\0';
    xSemaphoreGive(lock);
    if (xQueueSend(commands, &input, 0) != pdTRUE) {
      xSemaphoreTake(lock, portMAX_DELAY);
      pr_transfer_release(&transfer);
      xSemaphoreGive(lock);
      return BLE_ATT_ERR_INSUFFICIENT_RES;
    }
    return 0;
  }
  if (attribute == receipt_handle && ctx->op == BLE_GATT_ACCESS_OP_READ_CHR) {
    xSemaphoreTake(lock, portMAX_DELAY);
    int result;
    size_t length = strlen(receipt);
    if (length <= 480)
      result = append(ctx, receipt, length);
    else {
      uint8_t hash[32];
      size_t hash_length = 0;
      char hex[65], index[256];
      if (psa_hash_compute(PSA_ALG_SHA_256, (const uint8_t *)receipt, length,
                           hash, sizeof(hash), &hash_length) != PSA_SUCCESS ||
          hash_length != 32) {
        xSemaphoreGive(lock);
        return BLE_ATT_ERR_UNLIKELY;
      }
      for (size_t i = 0; i < 32; i++)
        snprintf(hex + 2 * i, 3, "%02x", hash[i]);
      int count = snprintf(
          index, sizeof(index),
          "{\"protocol\":\"proof-of-ready/receipt-pages/"
          "v1\",\"request_id\":\"%s\",\"length\":%u,\"sha256\":\"%s\"}",
          receipt_id, (unsigned)length, hex);
      result = count > 0 && count < (int)sizeof(index)
                   ? append(ctx, index, count)
                   : BLE_ATT_ERR_UNLIKELY;
    }
    xSemaphoreGive(lock);
    return result;
  }
  if (attribute == pages_handle) {
    if (ctx->op == BLE_GATT_ACCESS_OP_WRITE_CHR) {
      char raw[96];
      uint16_t length = 0;
      if (ble_hs_mbuf_to_flat(ctx->om, raw, sizeof(raw) - 1, &length) != 0)
        return BLE_ATT_ERR_INVALID_ATTR_VALUE_LEN;
      raw[length] = '\0';
      cJSON *document = cJSON_Parse(raw);
      cJSON *id = cJSON_GetObjectItemCaseSensitive(document, "request_id"),
            *offset = cJSON_GetObjectItemCaseSensitive(document, "offset");
      bool valid = cJSON_IsObject(document) &&
                   cJSON_GetArraySize(document) == 2 && cJSON_IsString(id) &&
                   cJSON_IsNumber(offset) && offset->valuedouble >= 0 &&
                   offset->valuedouble < PR_MAX_RECEIPT &&
                   offset->valuedouble == (int)offset->valuedouble;
      xSemaphoreTake(lock, portMAX_DELAY);
      if (valid)
        valid = !transfer.busy && !strcmp(id->valuestring, receipt_id) &&
                (size_t)offset->valueint < strlen(receipt);
      if (valid)
        page_offset = (size_t)offset->valueint;
      xSemaphoreGive(lock);
      cJSON_Delete(document);
      return valid ? 0 : BLE_ATT_ERR_UNLIKELY;
    }
    if (ctx->op == BLE_GATT_ACCESS_OP_READ_CHR) {
      xSemaphoreTake(lock, portMAX_DELAY);
      size_t total = strlen(receipt);
      if (transfer.busy || page_offset >= total) {
        xSemaphoreGive(lock);
        return BLE_ATT_ERR_UNLIKELY;
      }
      size_t length = total - page_offset;
      if (length > 384)
        length = 384;
      int result = append(ctx, receipt + page_offset, length);
      xSemaphoreGive(lock);
      return result;
    }
  }
  return BLE_ATT_ERR_UNLIKELY;
}
static void worker(void *unused) {
  (void)unused;
  command input;
  for (;;)
    if (xQueueReceive(commands, &input, portMAX_DELAY) == pdTRUE) {
      char result[PR_MAX_RECEIPT];
      int length =
          pr_dispatch(input.json, input.length, result, sizeof(result));
      xSemaphoreTake(lock, portMAX_DELAY);
      if (length > 0)
        memcpy(receipt, result, (size_t)length + 1);
      else
        strcpy(receipt, "{\"protocol\":\"capmesh/"
                        "0.1\",\"status\":\"error\",\"error\":{\"code\":"
                        "\"ENCODING_FAILED\"}}");
      cJSON *doc = cJSON_Parse(receipt);
      cJSON *id = cJSON_GetObjectItemCaseSensitive(doc, "request_id");
      if (cJSON_IsString(id) && strlen(id->valuestring) == 16)
        strcpy(receipt_id, id->valuestring);
      else
        receipt_id[0] = '\0';
      cJSON_Delete(doc);
      page_offset = 0;
      pr_transfer_release(&transfer);
      xSemaphoreGive(lock);
      // Notifications are a completion signal only. Read the exact original
      // receipt or its page index.
      ble_gatts_chr_updated(receipt_handle);
    }
}
static void advertise(void);
static int gap_event(struct ble_gap_event *event, void *arg) {
  (void)arg;
  if (event->type == BLE_GAP_EVENT_DISCONNECT) {
    xSemaphoreTake(lock, portMAX_DELAY);
    pr_transfer_disconnect(&transfer, event->disconnect.conn.conn_handle);
    xSemaphoreGive(lock);
  }
  if (event->type == BLE_GAP_EVENT_DISCONNECT ||
      event->type == BLE_GAP_EVENT_ADV_COMPLETE ||
      (event->type == BLE_GAP_EVENT_CONNECT && event->connect.status))
    advertise();
  return 0;
}
static void advertise(void) {
  struct ble_hs_adv_fields fields = {0};
  fields.flags = BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP;
  fields.uuids16 = (ble_uuid16_t[]){service_uuid};
  fields.num_uuids16 = 1;
  fields.uuids16_is_complete = 1;
  if (ble_gap_adv_set_fields(&fields))
    return;
  struct ble_gap_adv_params params = {0};
  params.conn_mode = BLE_GAP_CONN_MODE_UND;
  params.disc_mode = BLE_GAP_DISC_MODE_GEN;
  ble_gap_adv_start(address_type, NULL, BLE_HS_FOREVER, &params, gap_event,
                    NULL);
}
static void sync_ble(void) {
  if (!ble_hs_util_ensure_addr(0) && !ble_hs_id_infer_auto(0, &address_type))
    advertise();
}
static void host_task(void *unused) {
  (void)unused;
  nimble_port_run();
  nimble_port_freertos_deinit();
}
esp_err_t pr_ble_init(void) {
  lock = xSemaphoreCreateMutex();
  commands = xQueueCreate(1, sizeof(command));
  if (!lock || !commands)
    return ESP_ERR_NO_MEM;
  if (nimble_port_init() != ESP_OK)
    return ESP_FAIL;
  ble_hs_cfg.sync_cb = sync_ble;
  ble_svc_gap_init();
  ble_svc_gatt_init();
  if (ble_svc_gap_device_name_set("Proof of Ready") ||
      ble_gatts_count_cfg(services) || ble_gatts_add_svcs(services))
    return ESP_FAIL;
  if (xTaskCreate(worker, "proofready-operation", 12288, NULL, 5, NULL) !=
      pdPASS)
    return ESP_ERR_NO_MEM;
  nimble_port_freertos_init(host_task);
  return ESP_OK;
}

export class VisionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "VisionError";
    this.code = code;
  }
}

/** One private Worker owns OpenCV. No camera or network credentials enter it. */
export function createMarkerDetector() {
  const worker = new Worker(new URL("./detector-worker.js", import.meta.url));
  const pending = new Map();
  let sequence = 0;
  let closed = false;
  let settleReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => {
    settleReady = resolve;
    rejectReady = reject;
  });
  // A caller can stop during startup without creating an unhandled rejection.
  ready.catch(() => {});
  const close = (
    error = new VisionError("VISION_CLOSED", "The vision detector stopped."),
  ) => {
    if (closed) return;
    closed = true;
    clearTimeout(startupTimer);
    worker.terminate();
    rejectReady(error);
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    pending.clear();
  };
  const startupTimer = setTimeout(
    () =>
      close(
        new VisionError(
          "VISION_INIT_TIMEOUT",
          "The vision detector did not load. Check local assets and the Worker policy.",
        ),
      ),
    20000,
  );
  worker.onerror = (event) => {
    event.preventDefault();
    close(
      new VisionError(
        "VISION_INIT_FAILED",
        "The vision Worker failed. Check local assets and its security policy.",
      ),
    );
  };
  worker.onmessageerror = () =>
    close(
      new VisionError(
        "VISION_MESSAGE_INVALID",
        "The vision Worker returned an unreadable message.",
      ),
    );
  worker.onmessage = ({ data }) => {
    if (data?.ready === true) {
      clearTimeout(startupTimer);
      settleReady();
      return;
    }
    if (data?.error && data.id === null) {
      close(new VisionError(data.error.code, data.error.message));
      return;
    }
    const entry = pending.get(data?.id);
    if (!entry) return;
    pending.delete(data.id);
    clearTimeout(entry.timer);
    if (data.error)
      entry.reject(new VisionError(data.error.code, data.error.message));
    else entry.resolve(data.result);
  };
  const request = async (operation, fields, transfer = []) => {
    await ready;
    if (closed)
      throw new VisionError("VISION_CLOSED", "The vision detector stopped.");
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () =>
          close(
            new VisionError(
              "VISION_FRAME_TIMEOUT",
              "The vision detector stopped responding.",
            ),
          ),
        10000,
      );
      pending.set(id, { resolve, reject, timer });
      try {
        worker.postMessage({ id, operation, ...fields }, transfer);
      } catch (error) {
        pending.delete(id);
        clearTimeout(timer);
        reject(error);
      }
    });
  };
  return {
    ready,
    detect: ({ width, height, pixels }) =>
      request(
        "detect",
        { width, height, pixels },
        pixels instanceof ArrayBuffer ? [pixels] : [],
      ),
    generate: (markerId, sidePixels = 240) =>
      request("generate", { markerId, sidePixels }),
    close,
  };
}

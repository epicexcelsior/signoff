import { VisionError } from "./detector.js";
import { evaluateGeometry, normalizePolicy } from "./geometry.js";
import { alignOpticalChallenge, encodeOpticalChallenge } from "./optical.js";
import { measureOpticalRegion, normalizeOpticalRoi } from "./optical-region.js";

const round = (value, scale = 10) => Math.round(value * scale) / scale;
const clone = (value) => structuredClone(value);
const corners = (values) =>
  values.map(({ x, y }) => ({ x: round(x), y: round(y) }));

/** The caller awaits ready before emission, then calls finish after the signed execution returns. */
export function createOpticalCapture({
  video,
  detector,
  policy: suppliedPolicy,
  assertActive,
  camera: suppliedCamera,
  calibrationId,
  onFinish = () => {},
  challenge: suppliedChallenge,
  sessionId,
  roi: suppliedRoi,
  maxDurationMs = 30000,
  onSample = () => {},
}) {
  const policy = normalizePolicy(suppliedPolicy);
  const camera = clone(suppliedCamera);
  const encoded = encodeOpticalChallenge(suppliedChallenge);
  const challenge = {
    protocol: encoded.protocol,
    bits: encoded.bits,
    halfSymbolMs: encoded.halfSymbolMs,
  };
  const roi = normalizeOpticalRoi(suppliedRoi);
  if (
    typeof sessionId !== "string" ||
    !/^[A-Za-z0-9:._-]{1,128}$/.test(sessionId)
  )
    throw new VisionError(
      "VISION_SESSION_INVALID",
      "Supply the approved capture session identifier.",
    );
  if (
    !Number.isInteger(maxDurationMs) ||
    maxDurationMs < encoded.durationMs + 1000 ||
    maxDurationMs > 45000
  )
    throw new VisionError(
      "OPTICAL_DURATION_INVALID",
      "Use a capture limit that covers the challenge within forty-five seconds.",
    );
  if (typeof video.requestVideoFrameCallback !== "function")
    throw new VisionError(
      "OPTICAL_FRAME_API_UNAVAILABLE",
      "Use a browser with per-frame video callbacks for optical capture.",
    );
  assertActive();
  const canvas = document.createElement("canvas");
  const scale = Math.min(
    1,
    640 / Math.max(video.videoWidth, video.videoHeight),
  );
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const resolution = { width: canvas.width, height: canvas.height };
  const anchorWall = Date.now();
  const anchorMono = performance.now();
  const samples = [];
  const incidents = [];
  let phase = "ARMING";
  let callback = null;
  let processing = null;
  let previousFrame = null;
  let previousTimestamp = null;
  let readyResolved = false;
  let finished = false;
  let finishRequested = false;
  let tailTimer = null;
  let watchdog = null;
  let timeout = null;
  let resolveReady;
  let rejectReady;
  let resolveFinished;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  ready.catch(() => {});
  const completed = new Promise((resolve) => {
    resolveFinished = resolve;
  });
  const getState = () => ({
    phase,
    sampleCount: samples.length,
    elapsedMs: round(performance.now() - anchorMono),
    lastBrightness: samples.at(-1)?.brightness ?? null,
    incidents: clone(incidents),
  });
  const stopCallbacks = () => {
    if (callback !== null) video.cancelVideoFrameCallback(callback);
    callback = null;
    clearTimeout(watchdog);
    clearTimeout(timeout);
    clearTimeout(tailTimer);
    document.removeEventListener("visibilitychange", visibilityChanged);
    window.removeEventListener("pagehide", pageHidden);
  };
  const complete = async () => {
    if (finished) return;
    finished = true;
    stopCallbacks();
    if (processing) await processing.catch(() => {});
    const captureEndedAtMs = anchorWall + performance.now() - anchorMono;
    if (!readyResolved)
      rejectReady(
        new VisionError(
          incidents[0]?.code ?? "OPTICAL_INCOMPLETE",
          incidents[0]?.message ??
            "Optical capture ended before marker tracking became ready.",
        ),
      );
    const evidence = {
      schemaVersion: "proof-of-ready-optical-capture-v1",
      source: "browser-camera",
      sessionId,
      challenge,
      roi,
      camera: clone(camera),
      calibrationId,
      resolution,
      captureStartedAtMs: round(anchorWall),
      captureEndedAtMs: round(captureEndedAtMs),
      samples: clone(samples),
      incidents: clone(incidents),
    };
    evidence.evaluation = alignOpticalChallenge({ ...evidence, policy });
    phase = incidents.length ? "ERROR" : "COMPLETE";
    resolveFinished(evidence);
    onFinish();
  };
  const abort = (code, message) => {
    if (finished) return;
    incidents.push({
      code,
      message,
      elapsedMs: round(performance.now() - anchorMono),
    });
    void complete();
  };
  const visibilityChanged = () => {
    if (document.visibilityState === "hidden")
      abort(
        "OPTICAL_PAGE_HIDDEN",
        "Keep the camera page visible throughout optical capture.",
      );
  };
  const pageHidden = () =>
    abort(
      "OPTICAL_PAGE_HIDDEN",
      "The camera page closed during optical capture.",
    );
  const frame = (now, metadata) => {
    if (finished) return;
    callback = null;
    try {
      assertActive();
      if (document.visibilityState === "hidden")
        throw new VisionError(
          "OPTICAL_PAGE_HIDDEN",
          "Keep the camera page visible throughout optical capture.",
        );
      if (
        Math.abs(Date.now() - anchorWall - (performance.now() - anchorMono)) >
        100
      )
        throw new VisionError(
          "OPTICAL_CLOCK_CHANGED",
          "The browser clock changed during optical capture.",
        );
      if (
        !Number.isSafeInteger(metadata.presentedFrames) ||
        metadata.presentedFrames < 1 ||
        !Number.isFinite(metadata.presentationTime) ||
        (previousFrame !== null &&
          metadata.presentedFrames !== previousFrame + 1) ||
        (previousTimestamp !== null &&
          (metadata.presentationTime <= previousTimestamp ||
            metadata.presentationTime - previousTimestamp >
              encoded.halfSymbolMs * 0.6))
      )
        throw new VisionError(
          "OPTICAL_FRAME_DROPPED",
          "A dropped frame or camera-timing discontinuity interrupted optical capture.",
        );
      if (
        metadata.width !== camera.resolution.width ||
        metadata.height !== camera.resolution.height
      )
        throw new VisionError(
          "CAMERA_CHANGED",
          "The camera frame dimensions changed. Start a new capture session.",
        );
      if (processing)
        throw new VisionError(
          "OPTICAL_PROCESSING_OVERRUN",
          "Frame processing missed the next camera frame. Reduce camera resolution or load.",
        );
      if (samples.length >= 1500)
        throw new VisionError(
          "OPTICAL_SAMPLE_LIMIT",
          "The optical capture reached its sample limit.",
        );
      previousFrame = metadata.presentedFrames;
      previousTimestamp = metadata.presentationTime;
      clearTimeout(watchdog);
      watchdog = setTimeout(
        () =>
          abort(
            "OPTICAL_FRAME_TIMEOUT",
            "The camera supplied no new optical frame.",
          ),
        500,
      );
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ).data;
      const measurementPixels = new Uint8ClampedArray(pixels);
      const atMs = anchorWall + metadata.presentationTime - anchorMono;
      const operation = (async () => {
        const detected = await detector.detect({
          width: canvas.width,
          height: canvas.height,
          pixels: pixels.buffer,
        });
        if (finished) return;
        assertActive();
        const measurement = evaluateGeometry(
          { ...detected, resolution },
          policy,
        );
        if (measurement.state !== "PASS")
          throw new VisionError(
            "OPTICAL_TRACKING_LOST",
            "The markers left the approved placement or lost usable tracking.",
          );
        const device = detected.markers.find(
          (marker) => marker.id === policy.deviceMarkerId,
        );
        const reference = detected.markers.find(
          (marker) => marker.id === policy.referenceMarkerId,
        );
        const region = measureOpticalRegion({
          pixels: measurementPixels,
          width: canvas.width,
          height: canvas.height,
          corners: device.corners,
          roi,
        });
        const sample = {
          atMs: round(atMs),
          elapsedMs: round(metadata.presentationTime - anchorMono),
          brightness: round(region.brightness, 10000),
          contrast: round(region.contrast, 10000),
          tracked: true,
          frameNumber: metadata.presentedFrames,
          deviceCorners: corners(device.corners),
          referenceCorners: corners(reference.corners),
        };
        if (sample.elapsedMs < 0)
          throw new VisionError(
            "OPTICAL_FRAME_TIMING_INVALID",
            "The camera frame predates the optical capture.",
          );
        samples.push(sample);
        if (!readyResolved && samples.length >= 3) {
          readyResolved = true;
          phase = "CAPTURING";
          resolveReady({
            captureStartedAtMs: anchorWall,
            readyAtMs: sample.atMs,
            sampleCount: samples.length,
          });
        }
        onSample({
          sampleCount: samples.length,
          elapsedMs: sample.elapsedMs,
          brightness: sample.brightness,
        });
      })();
      processing = operation;
      operation.then(
        () => {
          if (processing === operation) processing = null;
        },
        (error) => {
          if (processing === operation) processing = null;
          abort(
            error.code ?? "OPTICAL_FRAME_INVALID",
            error instanceof VisionError
              ? error.message
              : "The optical frame lacks a usable tracked emitter region.",
          );
        },
      );
      callback = video.requestVideoFrameCallback(frame);
    } catch (error) {
      abort(
        error.code ?? "OPTICAL_FRAME_INVALID",
        error instanceof VisionError
          ? error.message
          : "The optical camera frame is invalid.",
      );
    }
  };
  watchdog = setTimeout(
    () =>
      abort(
        "OPTICAL_FRAME_TIMEOUT",
        "The camera supplied no new optical frame.",
      ),
    1000,
  );
  timeout = setTimeout(
    () =>
      abort(
        "OPTICAL_CAPTURE_TIMEOUT",
        "The optical capture reached its time limit before explicit completion.",
      ),
    maxDurationMs,
  );
  callback = video.requestVideoFrameCallback(frame);
  document.addEventListener("visibilitychange", visibilityChanged);
  window.addEventListener("pagehide", pageHidden);
  return {
    ready,
    getState,
    finish: ({ tailMs = 500 } = {}) => {
      if (!Number.isInteger(tailMs) || tailMs < 200 || tailMs > 2000)
        throw new VisionError(
          "OPTICAL_TAIL_INVALID",
          "Use an optical capture tail from two hundred to two thousand milliseconds.",
        );
      if (!finishRequested && !finished) {
        finishRequested = true;
        tailTimer = setTimeout(() => void complete(), tailMs);
      }
      return completed;
    },
    cancel: () => {
      abort("OPTICAL_CAPTURE_CANCELLED", "The optical capture was canceled.");
      return completed;
    },
  };
}

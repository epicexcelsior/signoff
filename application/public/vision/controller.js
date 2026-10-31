import { createMarkerDetector, VisionError } from "./detector.js";
import { evaluateGeometry, normalizePolicy } from "./geometry.js";
import { createOpticalCapture } from "./optical-capture.js";
import { normalizeOpticalRoi, projectOpticalRoi } from "./optical-region.js";

const digest = async (bytes) =>
  `0x${Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (value) => value.toString(16).padStart(2, "0")).join("")}`;
const digestText = (value) => digest(new TextEncoder().encode(value));
const clone = (value) => structuredClone(value);
const canonical = (value) =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );

function cameraGeometry(video, track) {
  const settings = track.getSettings();
  return {
    trackId: track.id,
    deviceId: settings.deviceId ?? "unavailable",
    width: video.videoWidth,
    height: video.videoHeight,
    trackWidth: settings.width ?? null,
    trackHeight: settings.height ?? null,
    aspectRatio: settings.aspectRatio ?? null,
    facingMode: settings.facingMode ?? null,
    resizeMode: settings.resizeMode ?? null,
    zoom: settings.zoom ?? null,
  };
}

function drawOpticalGuide(context, measurement, policy, roi) {
  if (
    !roi ||
    !measurement.quality.markerQuality.length ||
    !measurement.quality.markerQuality.every((quality) => quality.usable)
  )
    return;
  const device = measurement.markers.find(
    (marker) => marker.id === policy.deviceMarkerId,
  );
  if (!device) return;
  let region;
  try {
    region = projectOpticalRoi({ corners: device.corners, roi });
  } catch (error) {
    // A projection horizon makes only this optional guide unusable.
    if (error instanceof RangeError) return;
    throw error;
  }
  const { width, height } = measurement.calibration.resolution;
  if (region.some(({ x, y }) => x < 0 || y < 0 || x >= width || y >= height))
    return;
  const left = Math.min(...region.map(({ x }) => x));
  const right = Math.max(...region.map(({ x }) => x));
  const top = Math.min(...region.map(({ y }) => y));
  const bottom = Math.max(...region.map(({ y }) => y));
  context.save();
  context.font = "bold 14px sans-serif";
  const label = "LED sample";
  const labelWidth = Math.ceil(context.measureText(label).width) + 12;
  const labelHeight = 24;
  const markers = measurement.markers.map(({ corners }) => ({
    left: Math.min(...corners.map(({ x }) => x)) - 4,
    right: Math.max(...corners.map(({ x }) => x)) + 4,
    top: Math.min(...corners.map(({ y }) => y)) - 4,
    bottom: Math.max(...corners.map(({ y }) => y)) + 4,
  }));
  const position = [
    { x: right + 6, y: top },
    { x: left - labelWidth - 6, y: top },
    { x: left, y: top - labelHeight - 6 },
    { x: left, y: bottom + 6 },
  ]
    .map(({ x, y }) => ({
      x: Math.max(0, Math.min(width - labelWidth, x)),
      y: Math.max(0, Math.min(height - labelHeight, y)),
    }))
    .find(
      ({ x, y }) =>
        !markers.some(
          (marker) =>
            x < marker.right &&
            x + labelWidth > marker.left &&
            y < marker.bottom &&
            y + labelHeight > marker.top,
        ),
    );
  context.beginPath();
  region.forEach(({ x, y }, index) =>
    index ? context.lineTo(x, y) : context.moveTo(x, y),
  );
  context.closePath();
  context.fillStyle = "rgba(255,189,74,0.18)";
  context.fill();
  context.lineWidth = 5;
  context.strokeStyle = "#142920";
  context.stroke();
  context.lineWidth = 3;
  context.strokeStyle = "#ffbd4a";
  context.stroke();
  if (position) {
    context.fillStyle = "#142920";
    context.fillRect(position.x, position.y, labelWidth, labelHeight);
    context.fillStyle = "#ffffff";
    context.fillText(label, position.x + 6, position.y + 17);
  }
  context.restore();
}

function drawOverlay(canvas, measurement, policy, opticalRoi) {
  if (!canvas) return;
  const { width, height } = measurement.calibration.resolution;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, width, height);
  context.lineWidth = 3;
  context.font = "16px sans-serif";
  context.strokeStyle = measurement.state === "PASS" ? "#16704a" : "#9d641b";
  context.fillStyle = context.strokeStyle;
  for (const marker of measurement.markers) {
    context.beginPath();
    marker.corners.forEach((corner, index) =>
      index
        ? context.lineTo(corner.x, corner.y)
        : context.moveTo(corner.x, corner.y),
    );
    context.closePath();
    context.stroke();
    context.fillText(
      `ID ${marker.id}`,
      marker.corners[0].x,
      Math.max(18, marker.corners[0].y - 8),
    );
  }
  if (measurement.guidance) {
    const { targetCenter, targetAxis } = measurement.guidance;
    context.strokeStyle = "#2059b3";
    context.beginPath();
    context.arc(targetCenter.x, targetCenter.y, 14, 0, 2 * Math.PI);
    context.moveTo(targetCenter.x, targetCenter.y);
    context.lineTo(targetAxis.x, targetAxis.y);
    context.stroke();
  }
  drawOpticalGuide(context, measurement, policy, opticalRoi);
}

/**
 * Camera frames stay in this browser. Only measurements and a frame hash leave capture().
 * Planar guidance uses a measured reference and coplanar markers, without lens calibration.
 */
export function createVisionController({
  video,
  canvas = null,
  policy: suppliedPolicy,
  opticalRoi: suppliedOpticalRoi = null,
  deviceId = null,
  onState = () => {},
  onMeasurement = () => {},
}) {
  if (!video || typeof video.play !== "function")
    throw new TypeError("Supply a camera video element.");
  const policy = normalizePolicy(suppliedPolicy);
  const opticalRoi =
    suppliedOpticalRoi === null
      ? null
      : normalizeOpticalRoi(suppliedOpticalRoi);
  const sourceCanvas = document.createElement("canvas");
  const context = sourceCanvas.getContext("2d", { willReadFrequently: true });
  let state = {
    phase: "STOPPED",
    error: null,
    camera: null,
    calibrationId: null,
    lastMeasurement: null,
  };
  let generation = 0;
  let detector = null;
  let stream = null;
  let track = null;
  let geometryKey = null;
  let startPromise = null;
  let cancelStart = null;
  let framePromise = null;
  let captureGeneration = null;
  let opticalCapture = null;
  let timer = null;
  const getState = () => clone(state);
  const publish = () => onState(getState());
  const clearTimer = () => {
    clearTimeout(timer);
    timer = null;
  };
  const stoppedError = () =>
    new VisionError("VISION_STOPPED", "Start the camera before capture.");
  const checkActive = (expectedGeneration) => {
    if (generation !== expectedGeneration || state.phase !== "ACTIVE")
      throw stoppedError();
    if (track.readyState === "ended")
      throw new VisionError(
        "CAMERA_ENDED",
        "The camera stopped. Start a new capture session.",
      );
    if (canonical(cameraGeometry(video, track)) !== geometryKey)
      throw new VisionError(
        "CAMERA_CHANGED",
        "The camera, crop, zoom, or resolution changed. Start a new capture session.",
      );
  };
  const release = () => {
    clearTimer();
    void opticalCapture?.cancel();
    opticalCapture = null;
    detector?.close();
    detector = null;
    framePromise = null;
    stream?.getTracks().forEach((value) => value.stop());
    stream = null;
    track = null;
    video.srcObject = null;
    if (canvas)
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  };
  const fail = (error) => {
    generation++;
    release();
    state = {
      ...state,
      phase: "ERROR",
      error: {
        code: error.code ?? "CAMERA_FAILED",
        message:
          error instanceof VisionError
            ? error.message
            : "The camera failed. Check camera permission and start a new capture session.",
      },
      lastMeasurement: null,
    };
    publish();
  };
  const runFrame = (expectedGeneration) => {
    if (framePromise) return framePromise;
    const operation = (async () => {
      checkActive(expectedGeneration);
      const scale = Math.min(
        1,
        960 / Math.max(video.videoWidth, video.videoHeight),
      );
      sourceCanvas.width = Math.round(video.videoWidth * scale);
      sourceCanvas.height = Math.round(video.videoHeight * scale);
      context.drawImage(video, 0, 0, sourceCanvas.width, sourceCanvas.height);
      const capturedAt = Date.now();
      const pixels = context.getImageData(
        0,
        0,
        sourceCanvas.width,
        sourceCanvas.height,
      ).data.buffer;
      const frameDigest = await digest(pixels);
      checkActive(expectedGeneration);
      const detected = await detector.detect({
        width: sourceCanvas.width,
        height: sourceCanvas.height,
        pixels,
      });
      checkActive(expectedGeneration);
      const measurement = evaluateGeometry(
        {
          ...detected,
          resolution: {
            width: sourceCanvas.width,
            height: sourceCanvas.height,
          },
          capturedAt,
          calibrationId: state.calibrationId,
        },
        policy,
      );
      const evidence = {
        schemaVersion: "proof-of-ready-vision-v1",
        source: "browser-camera",
        frameDigest,
        resolution: { width: sourceCanvas.width, height: sourceCanvas.height },
        calibrationId: state.calibrationId,
        frameDigestEncoding: "sha256-rgba8-row-major",
        camera: clone(state.camera),
        ...measurement,
      };
      state = { ...state, lastMeasurement: evidence };
      drawOverlay(canvas, evidence, policy, opticalRoi);
      onMeasurement(clone(evidence));
      return evidence;
    })();
    framePromise = operation;
    operation
      .finally(() => {
        if (framePromise === operation) framePromise = null;
      })
      .catch(() => {});
    return operation;
  };
  const schedule = (expectedGeneration) => {
    clearTimer();
    if (
      state.phase !== "ACTIVE" ||
      generation !== expectedGeneration ||
      captureGeneration === expectedGeneration
    )
      return;
    timer = setTimeout(async () => {
      try {
        await runFrame(expectedGeneration);
      } catch (error) {
        if (generation === expectedGeneration) fail(error);
        return;
      }
      schedule(expectedGeneration);
    }, 150);
  };
  const stop = () => {
    generation++;
    cancelStart?.(stoppedError());
    cancelStart = null;
    release();
    state = {
      phase: "STOPPED",
      error: null,
      camera: null,
      calibrationId: null,
      lastMeasurement: null,
    };
    publish();
  };
  const start = () => {
    if (state.phase === "ACTIVE") return Promise.resolve(getState());
    if (state.phase === "STARTING" && startPromise) return startPromise;
    const expectedGeneration = ++generation;
    state = {
      phase: "STARTING",
      error: null,
      camera: null,
      calibrationId: null,
      lastMeasurement: null,
    };
    publish();
    let rejectCancellation;
    const cancellation = new Promise((_resolve, reject) => {
      rejectCancellation = reject;
    });
    cancelStart = rejectCancellation;
    const startup = (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new VisionError(
            "CAMERA_UNAVAILABLE",
            "Use localhost in a browser with camera support.",
          );
        detector = createMarkerDetector();
        await detector.ready;
        if (generation !== expectedGeneration) throw stoppedError();
        const acquired = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            ...(deviceId
              ? { deviceId: { exact: deviceId } }
              : { facingMode: "environment" }),
          },
          audio: false,
        });
        if (generation !== expectedGeneration) {
          acquired.getTracks().forEach((value) => value.stop());
          throw stoppedError();
        }
        stream = acquired;
        track = stream.getVideoTracks()[0];
        if (!track)
          throw new VisionError(
            "CAMERA_UNAVAILABLE",
            "The selected stream has no camera track.",
          );
        track.addEventListener(
          "ended",
          () => {
            if (generation === expectedGeneration && state.phase === "ACTIVE")
              fail(
                new VisionError(
                  "CAMERA_ENDED",
                  "The camera stopped. Start a new capture session.",
                ),
              );
          },
          { once: true },
        );
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () =>
              reject(
                new VisionError(
                  "CAMERA_FRAME_TIMEOUT",
                  "The camera supplied no image. Start a new capture session.",
                ),
              ),
            10000,
          );
          Promise.resolve(video.play()).then(
            () => {
              clearTimeout(timeout);
              resolve();
            },
            (error) => {
              clearTimeout(timeout);
              reject(error);
            },
          );
        });
        if (generation !== expectedGeneration) throw stoppedError();
        if (!video.videoWidth || !video.videoHeight)
          throw new VisionError(
            "CAMERA_FRAME_UNAVAILABLE",
            "The camera has no image. Start a new capture session.",
          );
        const geometry = cameraGeometry(video, track);
        geometryKey = canonical(geometry);
        const cameraId = await digestText(
          canonical({ deviceId: geometry.deviceId, trackId: geometry.trackId }),
        );
        const calibrationId = await digestText(
          canonical({
            version: "planar-v1",
            camera: geometry,
            referenceMarkerId: policy.referenceMarkerId,
            referenceSizeMm: policy.referenceSizeMm,
          }),
        );
        if (generation !== expectedGeneration) throw stoppedError();
        state = {
          phase: "ACTIVE",
          error: null,
          camera: {
            id: cameraId,
            resolution: { width: geometry.width, height: geometry.height },
            facingMode: geometry.facingMode,
            zoom: geometry.zoom,
            calibrationMode: "planar",
          },
          calibrationId,
          lastMeasurement: null,
        };
        publish();
        schedule(expectedGeneration);
        return getState();
      } catch (error) {
        if (generation === expectedGeneration) fail(error);
        throw error instanceof VisionError
          ? error
          : new VisionError(
              "CAMERA_FAILED",
              "The camera failed. Check camera permission and start a new capture session.",
            );
      }
    })();
    startPromise = Promise.race([startup, cancellation]).finally(() => {
      if (cancelStart === rejectCancellation) cancelStart = null;
    });
    return startPromise;
  };
  const capture = async ({ sessionId } = {}) => {
    if (
      typeof sessionId !== "string" ||
      !/^[A-Za-z0-9:._-]{1,128}$/.test(sessionId)
    )
      throw new VisionError(
        "VISION_SESSION_INVALID",
        "Supply the approved capture session identifier.",
      );
    if (captureGeneration === generation)
      throw new VisionError(
        "VISION_CAPTURE_BUSY",
        "Wait for the current camera capture.",
      );
    const expectedGeneration = generation;
    checkActive(expectedGeneration);
    captureGeneration = expectedGeneration;
    clearTimer();
    try {
      if (framePromise) await framePromise;
      checkActive(expectedGeneration);
      return { ...clone(await runFrame(expectedGeneration)), sessionId };
    } catch (error) {
      if (generation === expectedGeneration) fail(error);
      throw error;
    } finally {
      if (captureGeneration === expectedGeneration) captureGeneration = null;
      schedule(expectedGeneration);
    }
  };
  const startOpticalCapture = async (options = {}) => {
    const expectedGeneration = generation;
    checkActive(expectedGeneration);
    if (captureGeneration === expectedGeneration)
      throw new VisionError(
        "VISION_CAPTURE_BUSY",
        "Wait for the current camera capture.",
      );
    captureGeneration = expectedGeneration;
    clearTimer();
    try {
      if (framePromise) await framePromise;
      checkActive(expectedGeneration);
      const handle = createOpticalCapture({
        ...options,
        video,
        detector,
        policy,
        assertActive: () => checkActive(expectedGeneration),
        camera: state.camera,
        calibrationId: state.calibrationId,
        onFinish: () => {
          if (opticalCapture === handle) opticalCapture = null;
          if (captureGeneration === expectedGeneration)
            captureGeneration = null;
          schedule(expectedGeneration);
        },
      });
      opticalCapture = handle;
      return handle;
    } catch (error) {
      if (captureGeneration === expectedGeneration) captureGeneration = null;
      schedule(expectedGeneration);
      throw error;
    }
  };
  return { start, stop, capture, startOpticalCapture, getState };
}

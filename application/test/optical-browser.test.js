import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

async function openBrowser(t) {
  const app = express();
  app.use((req, res, next) => {
    res.set(
      "Content-Security-Policy",
      req.path === "/vision/detector-worker.js"
        ? "default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'none'"
        : "default-src 'self'; script-src 'self'; worker-src 'self'; connect-src 'self'",
    );
    next();
  });
  app.get("/", (_req, res) =>
    res
      .type("html")
      .send(
        '<!doctype html><html><body><video id="video" muted playsinline></video></body></html>',
      ),
  );
  app.use(express.static(fileURLToPath(new URL("../public", import.meta.url))));
  const server = await new Promise((resolve) => {
    const value = app.listen(0, "127.0.0.1", () => resolve(value));
  });
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  const browser = await chromium.launch(
    process.env.FIELDPROOF_BROWSER_EXECUTABLE
      ? {
          executablePath: process.env.FIELDPROOF_BROWSER_EXECUTABLE,
          headless: true,
        }
      : { channel: "chrome", headless: true },
  );
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  return page;
}

const policy = {
  referenceMarkerId: 0,
  deviceMarkerId: 10,
  referenceSizeMm: 60,
  target: { xMm: 100, yMm: 0, angleDeg: 0 },
  tolerance: { positionMm: 5, angleDeg: 5 },
};

test(
  "browser capture measures a complete synthetic optical sequence through the real OpenCV Worker",
  { timeout: 40000 },
  async (t) => {
    const page = await openBrowser(t);
    const result = await page.evaluate(async (policy) => {
      const { createMarkerDetector } = await import("/vision/detector.js");
      const { createOpticalCapture } = await import(
        "/vision/optical-capture.js"
      );
      const { encodeOpticalChallenge } = await import("/vision/optical.js");
      const detector = createMarkerDetector();
      await detector.ready;
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const context = canvas.getContext("2d");
      context.fillStyle = "white";
      context.fillRect(0, 0, 640, 480);
      for (const [id, x, y, side] of [
        [0, 100, 140, 120],
        [10, 330, 170, 60],
      ]) {
        const generated = await detector.generate(id, side);
        const image = new ImageData(side, side);
        const gray = new Uint8Array(generated.pixels);
        for (let index = 0; index < gray.length; index++) {
          image.data[index * 4] =
            image.data[index * 4 + 1] =
            image.data[index * 4 + 2] =
              gray[index];
          image.data[index * 4 + 3] = 255;
        }
        context.putImageData(image, x, y);
      }
      const challenge = { bits: "a19bf030", halfSymbolMs: 250 };
      const encoded = encodeOpticalChallenge(challenge);
      const epoch = Date.now();
      let virtualNow = 0;
      Object.defineProperty(performance, "now", { value: () => virtualNow });
      Date.now = () => epoch + virtualNow;
      Object.defineProperty(canvas, "videoWidth", { value: 640 });
      Object.defineProperty(canvas, "videoHeight", { value: 480 });
      let nextFrame;
      canvas.requestVideoFrameCallback = (callback) => {
        nextFrame = callback;
        return 1;
      };
      canvas.cancelVideoFrameCallback = () => {
        nextFrame = null;
      };
      let pending;
      let finished = 0;
      const camera = {
        id: `0x${"a".repeat(64)}`,
        resolution: { width: 640, height: 480 },
      };
      const capture = createOpticalCapture({
        video: canvas,
        detector: {
          detect: (frame) => {
            pending = detector.detect(frame);
            return pending;
          },
        },
        policy,
        assertActive: () => {},
        camera,
        calibrationId: `0x${"b".repeat(64)}`,
        onFinish: () => {
          finished++;
        },
        challenge,
        sessionId: "0123456789abcdef",
        roi: { x: 1.2, y: 0.25, width: 0.4, height: 0.4 },
      });
      // The caller cannot replace the challenge or camera identity during a capture.
      camera.id = "edited";
      challenge.bits = "ffffffff";
      let frameNumber = 0;
      for (virtualNow = 25; virtualNow <= 19525; virtualNow += 50) {
        const symbol = Math.floor((virtualNow - 750) / 250);
        const level =
          symbol >= 0 && symbol < encoded.symbols.length
            ? encoded.symbols[symbol]
            : 0;
        context.fillStyle = level ? "white" : "black";
        context.fillRect(400, 175, 32, 40);
        const callback = nextFrame;
        if (!callback)
          throw new Error(
            "Optical capture ended before the synthetic sequence completed.",
          );
        callback(virtualNow, {
          presentedFrames: ++frameNumber,
          presentationTime: virtualNow,
          width: 640,
          height: 480,
        });
        await pending;
        await Promise.resolve();
      }
      await capture.ready;
      const evidence = await capture.finish({ tailMs: 200 });
      detector.close();
      return {
        evidence,
        finished,
        callbackCleared: nextFrame === null,
        byteLength: new TextEncoder().encode(JSON.stringify(evidence)).length,
      };
    }, policy);
    assert.equal(result.evidence.evaluation.state, "PASS");
    assert.equal(result.evidence.evaluation.matchedSymbols, 72);
    assert.equal(result.evidence.samples.length, 391);
    assert.equal(result.evidence.challenge.bits, "a19bf030");
    assert.equal(result.evidence.camera.id, `0x${"a".repeat(64)}`);
    assert.equal(result.evidence.incidents.length, 0);
    assert.equal(result.finished, 1);
    assert.equal(result.callbackCleared, true);
    assert(result.byteLength < 1_000_000);
  },
);

test(
  "browser capture rejects discontinuity and releases every frame callback",
  { timeout: 15000 },
  async (t) => {
    const page = await openBrowser(t);
    const outcomes = await page.evaluate(async (policy) => {
      const { createOpticalCapture } = await import(
        "/vision/optical-capture.js"
      );
      const square = (x, y, side) => [
        { x, y },
        { x: x + side, y },
        { x: x + side, y: y + side },
        { x, y: y + side },
      ];
      const epoch = Date.now();
      let virtualNow = 0;
      Object.defineProperty(performance, "now", { value: () => virtualNow });
      Date.now = () => epoch + virtualNow;
      const outcomes = [];
      for (const scenario of [
        "dropped",
        "tracking",
        "camera",
        "pagehide",
        "cancel",
      ]) {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const context = canvas.getContext("2d");
        context.fillStyle = "white";
        context.fillRect(0, 0, 640, 480);
        context.fillStyle = "black";
        context.fillRect(185, 85, 30, 30);
        context.fillStyle = "white";
        context.fillRect(195, 95, 10, 10);
        Object.defineProperty(canvas, "videoWidth", { value: 640 });
        Object.defineProperty(canvas, "videoHeight", { value: 480 });
        let nextFrame;
        canvas.requestVideoFrameCallback = (callback) => {
          nextFrame = callback;
          return 1;
        };
        canvas.cancelVideoFrameCallback = () => {
          nextFrame = null;
        };
        let detected;
        let invalidTracking = false;
        let cameraChanged = false;
        let finishes = 0;
        const capture = createOpticalCapture({
          video: canvas,
          detector: {
            detect: async () => {
              detected = Promise.resolve({
                markers: invalidTracking
                  ? []
                  : [
                      { id: 0, corners: square(70, 70, 60) },
                      { id: 10, corners: square(185, 85, 30) },
                    ],
              });
              return detected;
            },
          },
          policy,
          assertActive: () => {
            if (cameraChanged) {
              const error = new Error("Camera changed.");
              error.code = "CAMERA_CHANGED";
              throw error;
            }
          },
          camera: {
            id: "test-camera",
            resolution: { width: 640, height: 480 },
          },
          calibrationId: "test-calibration",
          onFinish: () => {
            finishes++;
          },
          challenge: { bits: "a19bf030", halfSymbolMs: 250 },
          sessionId: "0123456789abcdef",
          roi: { x: 1.2, y: 0.25, width: 0.4, height: 0.4 },
        });
        const frame = async (number) => {
          virtualNow += 50;
          const callback = nextFrame;
          nextFrame = null;
          callback(virtualNow, {
            presentedFrames: number,
            presentationTime: virtualNow,
            width: 640,
            height: 480,
          });
          await detected;
          await Promise.resolve();
          await Promise.resolve();
        };
        for (let number = 1; number <= 3; number++) await frame(number);
        await capture.ready;
        if (scenario === "dropped") await frame(5);
        if (scenario === "tracking") {
          invalidTracking = true;
          await frame(4);
        }
        if (scenario === "camera") {
          cameraChanged = true;
          await frame(4);
        }
        if (scenario === "pagehide")
          window.dispatchEvent(new Event("pagehide"));
        const evidence = await capture.cancel();
        outcomes.push({
          scenario,
          state: evidence.evaluation.state,
          code: evidence.incidents[0].code,
          cleared: nextFrame === null,
          finishes,
        });
      }
      return outcomes;
    }, policy);
    assert.deepEqual(
      outcomes.map((outcome) => outcome.code),
      [
        "OPTICAL_FRAME_DROPPED",
        "OPTICAL_TRACKING_LOST",
        "CAMERA_CHANGED",
        "OPTICAL_PAGE_HIDDEN",
        "OPTICAL_CAPTURE_CANCELLED",
      ],
    );
    for (const outcome of outcomes) {
      assert.equal(outcome.state, "REVIEW");
      assert.equal(outcome.cleared, true);
      assert.equal(outcome.finishes, 1);
    }
  },
);

test(
  "camera controller fences optical capture against concurrent capture and stops it with the camera",
  { timeout: 40000 },
  async (t) => {
    const page = await openBrowser(t);
    const result = await page.evaluate(async (policy) => {
      const { createVisionController } = await import("/vision/controller.js");
      const source = document.createElement("canvas");
      source.width = 640;
      source.height = 480;
      source.getContext("2d").fillRect(0, 0, 640, 480);
      const stream = source.captureStream(30);
      const paintTimer = setInterval(
        () => source.getContext("2d").fillRect(0, 0, 1, 1),
        33,
      );
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        value: async () => stream,
      });
      const controller = createVisionController({
        video: document.getElementById("video"),
        policy,
      });
      await controller.start();
      const options = {
        sessionId: "0123456789abcdef",
        challenge: { bits: "a19bf030", halfSymbolMs: 250 },
        roi: { x: 1.2, y: 0.25, width: 0.4, height: 0.4 },
      };
      const handle = await controller.startOpticalCapture(options);
      const concurrentOptical = await controller
        .startOpticalCapture(options)
        .catch((error) => error.code);
      const concurrentPlacement = await controller
        .capture({ sessionId: options.sessionId })
        .catch((error) => error.code);
      controller.stop();
      clearInterval(paintTimer);
      const evidence = await handle.cancel();
      const readiness = await handle.ready.catch((error) => error.code);
      return {
        concurrentOptical,
        concurrentPlacement,
        readiness,
        incident: evidence.incidents[0].code,
        phase: controller.getState().phase,
        ended: stream
          .getTracks()
          .every((track) => track.readyState === "ended"),
      };
    }, policy);
    assert.equal(result.concurrentOptical, "VISION_CAPTURE_BUSY");
    assert.equal(result.concurrentPlacement, "VISION_CAPTURE_BUSY");
    assert.equal(result.incident, "OPTICAL_CAPTURE_CANCELLED");
    assert.equal(result.readiness, "OPTICAL_CAPTURE_CANCELLED");
    assert.equal(result.phase, "STOPPED");
    assert.equal(result.ended, true);
  },
);

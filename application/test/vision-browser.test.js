import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

const publicDirectory = fileURLToPath(new URL("../public", import.meta.url));
const parentPolicy =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
const workerPolicy =
  "default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'none'";

async function visionBrowser(t) {
  const app = express();
  app.use((req, res, next) => {
    res.set(
      "Content-Security-Policy",
      req.path === "/vision/detector-worker.js" ? workerPolicy : parentPolicy,
    );
    next();
  });
  app.get("/", (_req, res) =>
    res
      .type("html")
      .send(
        '<!doctype html><html><body><video id="camera" muted playsinline></video><canvas id="overlay"></canvas></body></html>',
      ),
  );
  app.use(express.static(publicDirectory));
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

test(
  "real OpenCV Worker detects generated markers under a narrow Worker policy",
  { timeout: 40000 },
  async (t) => {
    const page = await visionBrowser(t);
    const result = await page.evaluate(async () => {
      const { createMarkerDetector } = await import("/vision/detector.js");
      const detector = createMarkerDetector();
      try {
        await detector.ready;
        const generated = await detector.generate(10, 120);
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 200;
        const context = canvas.getContext("2d");
        context.fillStyle = "white";
        context.fillRect(0, 0, 200, 200);
        const image = new ImageData(120, 120);
        const gray = new Uint8Array(generated.pixels);
        for (let index = 0; index < gray.length; index++) {
          image.data[index * 4] =
            image.data[index * 4 + 1] =
            image.data[index * 4 + 2] =
              gray[index];
          image.data[index * 4 + 3] = 255;
        }
        context.putImageData(image, 40, 40);
        return await detector.detect({
          width: 200,
          height: 200,
          pixels: context.getImageData(0, 0, 200, 200).data.buffer,
        });
      } finally {
        detector.close();
      }
    });
    assert.equal(result.markers.length, 1);
    assert.equal(result.markers[0].id, 10);
    assert.equal(result.markers[0].corners.length, 4);
    assert.equal(result.dictionary, "DICT_4X4_50");
  },
);

const placementPolicy = {
  referenceMarkerId: 0,
  deviceMarkerId: 10,
  referenceSizeMm: 60,
  target: { xMm: 100, yMm: 0, angleDeg: 0 },
  tolerance: { positionMm: 5, angleDeg: 5 },
};

async function installCameraFixture(page) {
  await page.evaluate(async () => {
    const { createMarkerDetector } = await import("/vision/detector.js");
    const generator = createMarkerDetector();
    await generator.ready;
    const images = {};
    for (const id of [0, 10, 11]) {
      const marker = await generator.generate(id, 120);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 120;
      const image = new ImageData(120, 120);
      const gray = new Uint8Array(marker.pixels);
      for (let index = 0; index < gray.length; index++) {
        image.data[index * 4] =
          image.data[index * 4 + 1] =
          image.data[index * 4 + 2] =
            gray[index];
        image.data[index * 4 + 3] = 255;
      }
      canvas.getContext("2d").putImageData(image, 0, 0);
      images[id] = canvas;
    }
    generator.close();
    const source = document.createElement("canvas");
    source.width = 640;
    source.height = 480;
    window.cameraFixture = { source, images, calls: 0, streams: [] };
    window.paintFixture = ({
      id = 10,
      x = 360,
      angle = 0,
      reference = true,
      side = 60,
    } = {}) => {
      const context = source.getContext("2d");
      context.fillStyle = "white";
      context.fillRect(0, 0, source.width, source.height);
      if (reference) context.drawImage(images[0], 100, 140, 120, 120);
      context.save();
      context.translate(x, 200);
      context.rotate((angle * Math.PI) / 180);
      context.drawImage(images[id], -side / 2, -side / 2, side, side);
      context.restore();
    };
    window.paintFixture();
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        window.cameraFixture.calls++;
        const stream = source.captureStream(30);
        window.cameraFixture.streams.push(stream);
        setInterval(() => {
          const context = source.getContext("2d");
          context.fillStyle = "white";
          context.fillRect(0, 0, 1, 1);
        }, 33);
        return stream;
      },
    });
  });
}

test(
  "camera controller captures genuine marker geometry and releases camera on stop or calibration change",
  { timeout: 40000 },
  async (t) => {
    const page = await visionBrowser(t);
    await installCameraFixture(page);
    const initial = await page.evaluate(async (policy) => {
      const { createVisionController } = await import("/vision/controller.js");
      window.controller = createVisionController({
        video: document.getElementById("camera"),
        canvas: document.getElementById("overlay"),
        policy,
      });
      const starts = await Promise.all([
        controller.start(),
        controller.start(),
      ]);
      const result = await controller.capture({ sessionId: "test-session-1" });
      return { starts, result, calls: cameraFixture.calls };
    }, placementPolicy);
    assert.equal(initial.calls, 1);
    assert.equal(initial.starts[0].phase, "ACTIVE");
    assert.equal(initial.result.state, "PASS");
    assert.equal(initial.result.source, "browser-camera");
    assert.equal(initial.result.sessionId, "test-session-1");
    assert.deepEqual(initial.result.resolution, { width: 640, height: 480 });
    assert.match(initial.result.frameDigest, /^0x[0-9a-f]{64}$/);
    assert.match(initial.result.calibrationId, /^0x[0-9a-f]{64}$/);
    assert(initial.result.markers.some(({ id }) => id === 0));
    assert(initial.result.markers.some(({ id }) => id === 10));
    for (const [fixture, expected] of [
      [{ x: 400 }, "FAIL"],
      [{ angle: 90 }, "FAIL"],
      [{ id: 11 }, "REVIEW"],
      [{ reference: false }, "REVIEW"],
      [{ side: 12 }, "REVIEW"],
    ]) {
      await page.evaluate((fixture) => window.paintFixture(fixture), fixture);
      await page.waitForTimeout(80);
      const result = await page.evaluate(() =>
        controller.capture({ sessionId: "test-session-1" }),
      );
      assert.equal(result.state, expected);
    }
    const concurrency = await page.evaluate(async () => {
      const results = await Promise.allSettled([
        controller.capture({ sessionId: "test-session-1" }),
        controller.capture({ sessionId: "test-session-1" }),
      ]);
      return results.map((result) => ({
        status: result.status,
        code: result.reason?.code,
      }));
    });
    assert.equal(
      concurrency.filter(({ status }) => status === "fulfilled").length,
      1,
    );
    assert.equal(
      concurrency.find(({ status }) => status === "rejected").code,
      "VISION_CAPTURE_BUSY",
    );
    await page.evaluate(() => {
      cameraFixture.source.width = 800;
      window.paintFixture();
    });
    await page.waitForFunction(() => controller.getState().phase === "ERROR");
    const changed = await page.evaluate(() => ({
      state: controller.getState(),
      ended: cameraFixture.streams[0].getVideoTracks()[0].readyState,
      cleared: document.getElementById("camera").srcObject === null,
    }));
    assert.equal(changed.state.error.code, "CAMERA_CHANGED");
    assert.equal(changed.state.lastMeasurement, null);
    assert.equal(changed.ended, "ended");
    assert.equal(changed.cleared, true);
    await page.evaluate(async () => {
      cameraFixture.source.width = 640;
      window.paintFixture();
      await controller.start();
      controller.stop();
    });
    const stopped = await page.evaluate(async () => ({
      state: controller.getState(),
      ended: cameraFixture.streams.every((stream) =>
        stream.getVideoTracks().every((track) => track.readyState === "ended"),
      ),
      captureError: await controller
        .capture({ sessionId: "test-session-1" })
        .catch((error) => error.code),
    }));
    assert.equal(stopped.state.phase, "STOPPED");
    assert.equal(stopped.ended, true);
    assert.equal(stopped.captureError, "VISION_STOPPED");
  },
);

test(
  "stop during camera permission wait releases a late stream and does not restart",
  { timeout: 40000 },
  async (t) => {
    const page = await visionBrowser(t);
    await installCameraFixture(page);
    await page.evaluate(async (policy) => {
      const { createVisionController } = await import("/vision/controller.js");
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        configurable: true,
        value: () =>
          new Promise((resolve) => {
            window.grantCamera = resolve;
          }),
      });
      window.controller = createVisionController({
        video: document.getElementById("camera"),
        policy,
      });
      window.pendingStart = controller.start().then(
        () => "unexpected-success",
        (error) => error.code,
      );
    }, placementPolicy);
    await page.waitForFunction(() => typeof window.grantCamera === "function");
    const result = await page.evaluate(async () => {
      controller.stop();
      const stream = cameraFixture.source.captureStream(30);
      grantCamera(stream);
      const code = await pendingStart;
      return {
        code,
        phase: controller.getState().phase,
        ended: stream.getVideoTracks()[0].readyState,
      };
    });
    assert.deepEqual(result, {
      code: "VISION_STOPPED",
      phase: "STOPPED",
      ended: "ended",
    });
  },
);

test(
  "printable reference contains the genuine marker IDs at the declared size ratio",
  { timeout: 40000 },
  async (t) => {
    const page = await visionBrowser(t);
    const markers = await page.evaluate(async () => {
      const { createMarkerDetector } = await import("/vision/detector.js");
      const detector = createMarkerDetector();
      try {
        await detector.ready;
        const image = new Image();
        image.src = "/vision/target.svg";
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = 794;
        canvas.height = 1123;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return (
          await detector.detect({
            width: canvas.width,
            height: canvas.height,
            pixels: context.getImageData(0, 0, canvas.width, canvas.height).data
              .buffer,
          })
        ).markers;
      } finally {
        detector.close();
      }
    });
    assert.deepEqual(
      markers.map(({ id }) => id).sort((a, b) => a - b),
      [0, 10],
    );
    const edge = (marker) =>
      Math.hypot(
        marker.corners[1].x - marker.corners[0].x,
        marker.corners[1].y - marker.corners[0].y,
      );
    assert(
      Math.abs(
        edge(markers.find(({ id }) => id === 0)) /
          edge(markers.find(({ id }) => id === 10)) -
          2,
      ) < 0.03,
    );
  },
);

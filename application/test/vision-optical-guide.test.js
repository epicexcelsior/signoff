import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import { projectOpticalRoi } from "../public/vision/optical-region.js";

const roi = { x: 1.1, y: 0.25, width: 0.35, height: 0.35 };
const corners = [
  { x: 330, y: 170 },
  { x: 390, y: 170 },
  { x: 390, y: 230 },
  { x: 330, y: 230 },
];

test("LED guide projects the declared marker-relative sampling region and rejects unusable planes", () => {
  const expected = [
    { x: 396, y: 185 },
    { x: 417, y: 185 },
    { x: 417, y: 206 },
    { x: 396, y: 206 },
  ];
  projectOpticalRoi({ corners, roi }).forEach((point, index) => {
    assert(Math.abs(point.x - expected[index].x) < 1e-8);
    assert(Math.abs(point.y - expected[index].y) < 1e-8);
  });
  assert.throws(
    () => projectOpticalRoi({ corners, roi: { ...roi, x: 0 } }),
    /beside the device marker/,
  );
  assert.throws(
    () => projectOpticalRoi({ corners: Array(4).fill({ x: 0, y: 0 }), roi }),
    /degenerate/,
  );
  assert.throws(
    () =>
      projectOpticalRoi({
        corners: [
          { x: 0, y: 0 },
          { x: 6, y: 0 },
          { x: 6, y: 6 },
          { x: 0, y: 1 },
        ],
        roi,
      }),
    /usable marker plane/,
  );
});

test(
  "browser LED guide marks the actual sampled region and hides invalid or absent guidance",
  { timeout: 40000 },
  async (t) => {
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
          '<!doctype html><video id="camera" muted playsinline></video><canvas id="overlay"></canvas>',
        ),
    );
    app.use(
      express.static(fileURLToPath(new URL("../public", import.meta.url))),
    );
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
    const result = await page.evaluate(async (roi) => {
      const { createMarkerDetector } = await import("/vision/detector.js");
      const { createVisionController } = await import("/vision/controller.js");
      const { projectOpticalRoi } = await import("/vision/optical-region.js");
      const generator = createMarkerDetector();
      await generator.ready;
      const images = {};
      for (const id of [0, 10, 11]) {
        const generated = await generator.generate(id, 120);
        const image = new ImageData(120, 120);
        const pixels = new Uint8Array(generated.pixels);
        for (let i = 0; i < pixels.length; i++) {
          image.data[4 * i] =
            image.data[4 * i + 1] =
            image.data[4 * i + 2] =
              pixels[i];
          image.data[4 * i + 3] = 255;
        }
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 120;
        canvas.getContext("2d").putImageData(image, 0, 0);
        images[id] = canvas;
      }
      generator.close();
      const source = document.createElement("canvas");
      source.width = 640;
      source.height = 480;
      const sourceContext = source.getContext("2d");
      const paint = (id = 10, x = 330) => {
        sourceContext.fillStyle = "white";
        sourceContext.fillRect(0, 0, 640, 480);
        sourceContext.drawImage(images[0], 100, 140, 120, 120);
        sourceContext.drawImage(images[id], x, 170, 60, 60);
      };
      paint();
      const streams = [];
      const timers = [];
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        configurable: true,
        value: async () => {
          const stream = source.captureStream(30);
          streams.push(stream);
          timers.push(
            setInterval(() => sourceContext.fillRect(0, 0, 1, 1), 33),
          );
          return stream;
        },
      });
      const video = document.getElementById("camera"),
        canvas = document.getElementById("overlay");
      const policy = {
        referenceMarkerId: 0,
        deviceMarkerId: 10,
        referenceSizeMm: 60,
        target: { xMm: 100, yMm: 0, angleDeg: 0 },
        tolerance: { positionMm: 5, angleDeg: 5 },
      };
      const pixel = (x, y) =>
        Array.from(canvas.getContext("2d").getImageData(x, y, 1, 1).data);
      let controller = createVisionController({
        video,
        canvas,
        policy,
        opticalRoi: roi,
      });
      try {
        await controller.start();
        const first = await controller.capture({ sessionId: "guide-test" });
        const device = first.markers.find((marker) => marker.id === 10);
        const region = projectOpticalRoi({ corners: device.corners, roi });
        const center = {
          x: Math.round((region[0].x + region[2].x) / 2),
          y: Math.round((region[0].y + region[2].y) / 2),
        };
        const guided = pixel(center.x, center.y);
        const markerInterior = pixel(340, 180);
        const overlaySnapshot = canvas.toDataURL();
        paint(11);
        await new Promise((resolve) =>
          video.requestVideoFrameCallback(resolve),
        );
        const wrong = await controller.capture({ sessionId: "wrong-marker" });
        const hiddenWrong = pixel(center.x, center.y);
        paint(10, 560);
        await new Promise((resolve) =>
          video.requestVideoFrameCallback(resolve),
        );
        const outside = await controller.capture({
          sessionId: "outside-region",
        });
        const hiddenOutside = pixel(632, 195);
        controller.stop();
        paint();
        controller = createVisionController({ video, canvas, policy });
        await controller.start();
        await controller.capture({ sessionId: "no-guide" });
        const omitted = pixel(center.x, center.y);
        return {
          overlaySnapshot,
          state: first.state,
          guided,
          markerInterior,
          hiddenWrong,
          wrongHasDevice: wrong.markers.some((m) => m.id === 10),
          hiddenOutside,
          outsideHasDevice: outside.markers.some((m) => m.id === 10),
          omitted,
        };
      } finally {
        controller.stop();
        timers.forEach(clearInterval);
        streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
      }
    }, roi);
    assert.equal(result.state, "PASS");
    [255, 189, 74].forEach((channel, index) =>
      assert(Math.abs(result.guided[index] - channel) <= 3),
    );
    writeFileSync(
      "/tmp/proof-ready-optical-guide.png",
      Buffer.from(result.overlaySnapshot.split(",")[1], "base64"),
    );
    assert(result.guided[3] > 0);
    assert.equal(result.markerInterior[3], 0);
    assert.equal(result.wrongHasDevice, false);
    assert.equal(result.hiddenWrong[3], 0);
    assert.equal(result.outsideHasDevice, true);
    assert.equal(result.hiddenOutside[3], 0);
    assert.equal(result.omitted[3], 0);
  },
);

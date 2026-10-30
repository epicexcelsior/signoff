/* Classic Worker: only this response needs dynamic execution for upstream Embind. */
(() => {
  let detector;
  let dictionary;
  let cvRuntime;
  let ready = false;
  const fail = (id, code, message) =>
    self.postMessage({ id, error: { code, message } });
  const initialize = () => {
    if (ready || !self.cv?.Mat) return;
    cvRuntime = self.cv;
    dictionary = cvRuntime.getPredefinedDictionary(cvRuntime.DICT_4X4_50);
    const parameters = new cvRuntime.aruco_DetectorParameters();
    const refine = new cvRuntime.aruco_RefineParameters(10, 3, true);
    if (typeof cvRuntime.CORNER_REFINE_SUBPIX === "number")
      parameters.cornerRefinementMethod = cvRuntime.CORNER_REFINE_SUBPIX;
    detector = new cvRuntime.aruco_ArucoDetector(
      dictionary,
      parameters,
      refine,
    );
    parameters.delete();
    refine.delete();
    ready = true;
    self.postMessage({
      ready: true,
      version: "4.13.0",
      dictionary: "DICT_4X4_50",
    });
  };
  self.Module = { onRuntimeInitialized: initialize };
  try {
    self.importScripts(
      new URL("../vendor/opencv-4.13.0/opencv.js", self.location.href).href,
    );
    initialize();
  } catch {
    fail(
      null,
      "VISION_INIT_FAILED",
      "OpenCV did not initialize. Check local assets and the vision Worker policy.",
    );
  }
  self.onmessage = ({ data }) => {
    const id = data?.id;
    if (!Number.isSafeInteger(id)) return;
    if (!ready)
      return fail(id, "VISION_NOT_READY", "Wait for the vision detector.");
    const allocations = [];
    const keep = (value) => {
      allocations.push(value);
      return value;
    };
    try {
      if (data.operation === "generate") {
        const { markerId, sidePixels } = data;
        if (
          !Number.isInteger(markerId) ||
          markerId < 0 ||
          markerId >= 50 ||
          !Number.isInteger(sidePixels) ||
          sidePixels < 6 ||
          sidePixels > 1024
        )
          throw new TypeError();
        const marker = keep(new cvRuntime.Mat());
        dictionary.generateImageMarker(markerId, sidePixels, marker, 1);
        const pixels = new Uint8Array(marker.data);
        self.postMessage(
          {
            id,
            result: {
              width: marker.cols,
              height: marker.rows,
              pixels: pixels.buffer,
            },
          },
          [pixels.buffer],
        );
      } else if (data.operation === "detect") {
        const { width, height, pixels } = data;
        if (
          !Number.isInteger(width) ||
          !Number.isInteger(height) ||
          width < 1 ||
          height < 1 ||
          width > 4096 ||
          height > 4096 ||
          width * height > 4194304 ||
          !(pixels instanceof ArrayBuffer) ||
          pixels.byteLength !== width * height * 4
        )
          throw new TypeError();
        const started = performance.now();
        const source = keep(
          cvRuntime.matFromArray(
            height,
            width,
            cvRuntime.CV_8UC4,
            new Uint8Array(pixels),
          ),
        );
        const gray = keep(new cvRuntime.Mat());
        cvRuntime.cvtColor(source, gray, cvRuntime.COLOR_RGBA2GRAY);
        const corners = keep(new cvRuntime.MatVector());
        const ids = keep(new cvRuntime.Mat());
        detector.detectMarkers(gray, corners, ids);
        const markers = [];
        for (let index = 0; index < ids.rows; index++) {
          const values = corners.get(index);
          try {
            markers.push({
              id: ids.data32S[index],
              corners: Array.from({ length: 4 }, (_, corner) => ({
                x: values.data32F[corner * 2],
                y: values.data32F[corner * 2 + 1],
              })),
            });
          } finally {
            values.delete();
          }
        }
        self.postMessage({
          id,
          result: {
            markers,
            processingMs: performance.now() - started,
            dictionary: "DICT_4X4_50",
          },
        });
      } else
        fail(
          id,
          "VISION_OPERATION_INVALID",
          "Use a supported vision operation.",
        );
    } catch {
      fail(
        id,
        "VISION_FRAME_INVALID",
        "Use a bounded RGBA frame or a valid marker request.",
      );
    } finally {
      for (const allocation of allocations.reverse()) allocation.delete();
    }
  };
})();

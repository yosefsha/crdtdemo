import React, {
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import css from "../styles/Canvas.module.css";
import { PixelDataCRDT, PixelDelta } from "../crdt/PixelDataCRDT";
import { RGB } from "../crdt/CRDTTypes";
interface CanvasEditorProps {
  width: number;
  height: number;
  onStateChange: () => void;
  color: RGB | null;
  pixelData: PixelDataCRDT;
  sharedState: number;
  cursor: string;
}

const CanvasEditor = forwardRef(function CanvasEditor(
  {
    width,
    height,
    onStateChange,
    color,
    pixelData,
    sharedState,
    cursor,
  }: CanvasEditorProps,
  ref
) {
  const deltasRef = useRef<PixelDelta[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const getTimestamp = () => {
    const now = new Date();
    return (
      now.toTimeString().split(" ")[0] +
      "." +
      now.getMilliseconds().toString().padStart(3, "0")
    );
  };

  const handlePointerDown = (e: PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error(
        `[${getTimestamp()}] CanvasEditor:${pixelData.id} - No canvas found in PointerDown.`
      );
      return;
    }
    canvas.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    console.log(
      `[${getTimestamp()}] CanvasEditor:${pixelData.id} - PointerDown event: did set pointer capture and isDrawing to true.`
    );
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error(
        `[${getTimestamp()}] CanvasEditor:${pixelData.id} - No canvas found in PointerMove.`
      );
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / (rect.width / width));
    const y = Math.floor((e.clientY - rect.top) / (rect.height / height));
    if (
      lastPosRef.current &&
      (lastPosRef.current.x !== x || lastPosRef.current.y !== y)
    ) {
      // Draw a line from the last position to the current position
      drawLine({ x: lastPosRef.current.x, y: lastPosRef.current.y }, { x, y });
    }
    lastPosRef.current = { x, y };
  };

  const drawLine = (
    start: { x: number; y: number },
    end: { x: number; y: number }
  ) => {
    // Calculate the differences in the x and y coordinates
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);

    // Determine the direction of the line
    const sx = start.x < end.x ? 1 : -1;
    const sy = start.y < end.y ? 1 : -1;

    // Initialize the error term
    let err = dx - dy;
    let e2;

    while (true) {
      // Paint the current pixel
      draw(start.x, start.y);

      // Check if the end point has been reached
      if (start.x === end.x && start.y === end.y) break;

      // Calculate the error term
      e2 = 2 * err;

      // Adjust the error term and the x coordinate
      if (e2 > -dy) {
        err -= dy;
        start.x += sx;
      }

      // Adjust the error term and the y coordinate
      if (e2 < dx) {
        err += dx;
        start.y += sy;
      }
    }
  };

  const draw = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error(
        `[${getTimestamp()}] CanvasEditor:${pixelData.id} - No canvas found in draw.`
      );
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error(
        `[${getTimestamp()}] CanvasEditor:${pixelData.id} - No 2D context found in draw.`
      );
      return;
    }

    // Update pixel data
    const delta = pixelData.set(PixelDataCRDT.getKey(x, y), color);
    if (!delta) return;
    deltasRef.current.push(delta);
    drawOnCanvas(x, y, color || [255, 255, 255], ctx);
  };

  async function drawOnCanvas(
    x: number,
    y: number,
    color: RGB,
    ctx: CanvasRenderingContext2D
  ) {
    /** Number of channels per pixel; R, G, B, A */
    const chans = 4;

    /** A buffer to hold the raw pixel data.
     * Each pixel corresponds to four bytes in the buffer,
     * so the full size is the number of pixels times the number of channels per pixel. */
    const buffer = new Uint8ClampedArray(chans);
    // set the pixel color at position (x, y) on canvas to the color
    if (color) {
      buffer[0] = color[0];
      buffer[1] = color[1];
      buffer[2] = color[2];
      buffer[3] = 255; // Alpha channel
      const imageData = new ImageData(buffer, 1, 1);
      console.debug(
        `[${getTimestamp()}] CanvasEditor:${pixelData.id} - draw color: [${color}] at (${x}, ${y})`
      );
      // draw the pixel on the canvas
      ctx.putImageData(imageData, x, y);
    }
  }

  const handlePointerUp = () => {
    isDrawingRef.current = false;
    lastPosRef.current = null;
    console.log(
      `[${getTimestamp()}] CanvasEditor:${pixelData.id} - PointerUp event did set isDrawing to false and lastPos to null. deltasRef.current:`,
      deltasRef.current
    );
    onStateChange();
    deltasRef.current = [];
  };

  const drawCanvasFromData = (ctx: CanvasRenderingContext2D) => {
    console.log(
      `[${getTimestamp()}] CanvasEditor:${pixelData.id} - drawCanvas: isDrawingRef.current: ${isDrawingRef.current}`
    );
    const imgData = ctx.createImageData(width, height);

    // Determine CRDT resolution by checking if we have high-res data
    // If we have data beyond the canvas dimensions, we're dealing with enhanced high-res data
    let crdtWidth = width;
    let crdtHeight = height;

    // Check if we have high-resolution data (enhanced image)
    const hasHighResData =
      pixelData.get(PixelDataCRDT.getKey(width, height)) !== null;
    if (hasHighResData) {
      // Assume enhanced resolution is 512x512 (common SDXL output)
      crdtWidth = 512;
      crdtHeight = 512;
      console.log(
        `[${getTimestamp()}] Detected high-res CRDT data: ${crdtWidth}x${crdtHeight}, scaling to canvas: ${width}x${height}`
      );
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;

        // Scale canvas coordinates to CRDT coordinates
        const crdtX = Math.floor((x / width) * crdtWidth);
        const crdtY = Math.floor((y / height) * crdtHeight);

        const [r, g, b] = pixelData.get(PixelDataCRDT.getKey(crdtX, crdtY)) ?? [
          255, 255, 255,
        ];
        imgData.data[index] = r;
        imgData.data[index + 1] = g;
        imgData.data[index + 2] = b;
        imgData.data[index + 3] = 255; // Alpha channel
      }
    }
    ctx.putImageData(imgData, 0, 0);
  };

  useEffect(() => {
    console.log(
      `[${getTimestamp()}] CanvasEditor:${pixelData.id} - useEffect: color: [${color}]`
    );
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error(
        `[${getTimestamp()}] CanvasEditor:${pixelData.id} - No canvas found in useEffect.`
      );
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error(
        `[${getTimestamp()}] CanvasEditor:${pixelData.id} - No 2D context found in useEffect.`
      );
      return;
    }

    drawCanvasFromData(ctx);

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointerleave", handlePointerUp);

    return () => {
      console.log(
        `[${getTimestamp()}] CanvasEditor:${pixelData.id} - Cleaning up event listeners.`
      );
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointerleave", handlePointerUp);
    };
  }, [color, pixelData, width, height, onStateChange]);

  // listen for changes in the shared state
  useEffect(() => {
    console.log(
      `[${getTimestamp()}] CanvasEditor:${pixelData.id} - useEffect: sharedState: ${sharedState}`
    );
    // pixelData.merge(sharedState);
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error(
        `[${getTimestamp()}] CanvasEditor:${pixelData.id} - No canvas found in useEffect sharedState.`
      );
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error(
        `[${getTimestamp()}] CanvasEditor:${pixelData.id} - No 2D context found in useEffect sharedState.`
      );
      return;
    }
    drawCanvasFromData(ctx);
  }, [sharedState]);

  useEffect(() => {
    console.info(
      `[${getTimestamp()}] CanvasEditor: - useEffect: cursor: ${cursor}`
    );
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = cursor; // Apply cursor style
    }
  }, [cursor]);

  // Expose fromBase64Image via ref
  useImperativeHandle(ref, () => ({
    fromBase64Image: async (crdt: PixelDataCRDT, base64: string) => {
      // Don't scale down - let fromBase64Image determine the appropriate size
      // or keep the enhanced image size
      await fromBase64Image(crdt, base64);
      // Force redraw after loading image
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          drawCanvasFromData(ctx);
        }
      }
    },
  }));

  return (
    <canvas
      className={css.canvas}
      ref={canvasRef}
      width={width}
      height={height}
    />
  );
});

// Utility: Convert PixelDataCRDT to base64 image
export function toBase64Image(
  pixelData: PixelDataCRDT,
  targetWidth: number,
  targetHeight: number
): string {
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(targetWidth, targetHeight);

  // Determine the source resolution of the CRDT data
  // Check if we have high-res data or just canvas-res data
  let sourceWidth = 200; // Default canvas resolution
  let sourceHeight = 200;

  // If we're asked to create a larger image, check if we have high-res source data
  if (targetWidth > 200 || targetHeight > 200) {
    const hasHighResData =
      pixelData.get(PixelDataCRDT.getKey(250, 250)) !== null;
    if (hasHighResData) {
      sourceWidth = 512; // We have high-res data
      sourceHeight = 512;
      console.log(
        `[toBase64Image] Using high-res source: ${sourceWidth}x${sourceHeight} -> ${targetWidth}x${targetHeight}`
      );
    } else {
      console.log(
        `[toBase64Image] Scaling up canvas data: ${sourceWidth}x${sourceHeight} -> ${targetWidth}x${targetHeight}`
      );
    }
  }

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const i = (y * targetWidth + x) * 4;

      // Scale target coordinates back to source coordinates
      const sourceX = Math.floor((x / targetWidth) * sourceWidth);
      const sourceY = Math.floor((y / targetHeight) * sourceHeight);

      const color = pixelData.get(PixelDataCRDT.getKey(sourceX, sourceY)) || [
        255, 255, 255,
      ];
      imageData.data[i] = color[0];
      imageData.data[i + 1] = color[1];
      imageData.data[i + 2] = color[2];
      imageData.data[i + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
}

// Utility: Convert base64 image to PixelDataCRDT
async function fromBase64Image(
  crdt: PixelDataCRDT,
  base64: string,
  targetWidth?: number,
  targetHeight?: number
): Promise<PixelDataCRDT> {
  console.log(`[fromBase64Image] Input: base64 length=${base64.length}`);

  const img = new Image();
  img.src = base64;
  await img.decode();

  // Use the actual image dimensions if no target specified, or the enhanced size
  const finalWidth = targetWidth || img.width;
  const finalHeight = targetHeight || img.height;

  console.log(
    `[fromBase64Image] Loaded image: ${img.width}x${img.height} → using ${finalWidth}x${finalHeight}`
  );

  // Create a canvas to resize the image if needed
  const canvas = document.createElement("canvas");
  canvas.width = finalWidth;
  canvas.height = finalHeight;
  const ctx = canvas.getContext("2d")!;

  // Draw the image scaled to fit the target size (or keep original if no scaling)
  ctx.drawImage(img, 0, 0, finalWidth, finalHeight);
  const imageData = ctx.getImageData(0, 0, finalWidth, finalHeight);

  console.log(
    `[fromBase64Image] Generated imageData: ${imageData.width}x${imageData.height}`
  );

  // Clear existing CRDT data (manually remove all existing pixels)
  // Since there's no clear method, we'll just overwrite all pixels

  // Populate CRDT with image data
  for (let y = 0; y < finalHeight; y++) {
    for (let x = 0; x < finalWidth; x++) {
      const i = (y * finalWidth + x) * 4;
      const color: RGB = [
        imageData.data[i],
        imageData.data[i + 1],
        imageData.data[i + 2],
      ];
      crdt.set(PixelDataCRDT.getKey(x, y), color);
    }
  }

  console.log(
    `[fromBase64Image] Updated CRDT with ${finalWidth * finalHeight} pixels`
  );
  return crdt;
}

export default CanvasEditor;

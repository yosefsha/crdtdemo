import React, { useRef, useEffect } from "react";
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

const CanvasEditor: React.FC<CanvasEditorProps> = ({
  width,
  height,
  onStateChange,
  color,
  pixelData,
  sharedState,
  cursor,
}) => {
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
      console.log(
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
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const [r, g, b] = pixelData.get(PixelDataCRDT.getKey(x, y)) ?? [
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
  return (
    <canvas
      className={css.canvas}
      ref={canvasRef}
      width={width}
      height={height}
    />
  );
};

export default CanvasEditor;

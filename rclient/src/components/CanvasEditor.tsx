import React, { useRef, useEffect } from "react";
import css from "../styles/Canvas.module.css";
import { PixelDataCRDT, RGB } from "../crdt/PixelDataCRDT";
import { State } from "../crdt/CRDTTypes";

interface CanvasEditorProps {
  id: string;
  width: number;
  height: number;
  onStateChange: (state: State<RGB>) => void;
  color: [number, number, number];
  pixelData: PixelDataCRDT;
}

const CanvasEditor: React.FC<CanvasEditorProps> = ({
  id,
  width,
  height,
  onStateChange,
  color,
  pixelData,
}) => {
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
    console.log(
      `[${getTimestamp()}] CanvasEditor:${id} - PointerDown event:`,
      e
    );

    const canvas = canvasRef.current;
    if (!canvas) {
      console.error(
        `[${getTimestamp()}] CanvasEditor:${id} - No canvas found in PointerDown.`
      );
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / (rect.width / width));
    const y = Math.floor((e.clientY - rect.top) / (rect.height / height));

    console.log(
      `[${getTimestamp()}] CanvasEditor:${id} - Start drawing at (${x}, ${y}).`
    );
    isDrawingRef.current = true;
    lastPosRef.current = { x, y };
    handlePointerEvent(e);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDrawingRef.current) return;

    console.log(
      `[${getTimestamp()}] CanvasEditor:${id} - PointerMove event:`,
      e
    );
    handlePointerEvent(e);
  };

  const handlePointerUp = () => {
    console.log(`[${getTimestamp()}] CanvasEditor:${id} - PointerUp event.`);
    isDrawingRef.current = false;
    lastPosRef.current = null;
  };

  const handlePointerEvent = (e: PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error(
        `[${getTimestamp()}] CanvasEditor:${id} - No canvas found in PointerEvent.`
      );
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / (rect.width / width));
    const y = Math.floor((e.clientY - rect.top) / (rect.height / height));
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      console.error(
        `[${getTimestamp()}] CanvasEditor:${id} - No 2D context found.`
      );
      return;
    }
    console.log(
      `[${getTimestamp()}] CanvasEditor:${id} - Drawing at (${x}, ${y}). Color: [${color[0]}, ${color[1]}, ${color[2]}].`
    );

    pixelData.set(x, y, color);
    // Validate update
    if (pixelData.get(x, y) !== color) {
      console.error(
        `[${getTimestamp()}] CanvasEditor:${id} - PixelData update failed at (${x}, ${y}).`
      );
    }

    if (lastPosRef.current) {
      console.log(
        `[${getTimestamp()}] CanvasEditor:${id} - Drawing line from (${lastPosRef.current.x}, ${lastPosRef.current.y}) to (${x}, ${y}).`
      );
      ctx.beginPath();
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(x, y);
      ctx.strokeStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
      ctx.globalAlpha = 1.0;
      ctx.stroke();
    }

    lastPosRef.current = { x, y };

    console.log(
      `[${getTimestamp()}] CanvasEditor:${id} - Updated pixel data state.`
    );
    onStateChange(pixelData.state);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error(
        `[${getTimestamp()}] CanvasEditor:${id} - No canvas found in useEffect.`
      );
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error(
        `[${getTimestamp()}] CanvasEditor:${id} - No 2D context found in useEffect.`
      );
      return;
    }

    ctx.globalAlpha = 1.0;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    const drawCanvas = () => {
      console.log(
        `[${getTimestamp()}] CanvasEditor:${id} - drawCanvas: isDrawingRef.current: ${isDrawingRef.current}`
      );
      const imgData = ctx.createImageData(width, height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          const [r, g, b] = pixelData.get(x, y);
          if (r !== 255 || g !== 255 || b !== 255) {
            console.log(
              `[${getTimestamp()}] CanvasEditor:${id} - drawCanvas: pixelData.get(${x}, ${y}): [${r}, ${g}, ${b}]`
            );
          }
          imgData.data[index] = r;
          imgData.data[index + 1] = g;
          imgData.data[index + 2] = b;
          imgData.data[index + 3] = 255; // Alpha channel
        }
      }
      ctx.putImageData(imgData, 0, 0);
    };

    drawCanvas();

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointerleave", handlePointerUp);

    return () => {
      console.log(
        `[${getTimestamp()}] CanvasEditor:${id} - Cleaning up event listeners.`
      );
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointerleave", handlePointerUp);
    };
  }, [color]);

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

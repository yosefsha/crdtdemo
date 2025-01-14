import React, { useRef, useEffect, useState } from "react";
import css from "../styles/Canvas.module.css";
import { PixelDataCRDT, RGB } from "../crdt/PixelDataCRDT";
import { State } from "../crdt/CRDTTypes";
import { ulid } from "ulid";

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
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;
    ctx.globalAlpha = 1.0; // Set it to 1.0 for full opacity
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    // Log the canvas size and context settings
    console.log(`Canvas size: width=${canvas.width}, height=${canvas.height}`);
    console.log(
      `Canvas context settings: lineWidth=${ctx.lineWidth}, lineCap=${ctx.lineCap}, globalAlpha=${ctx.globalAlpha}`
    );
    const drawCanvas = (ctx: CanvasRenderingContext2D) => {
      console.log(`CanvasEditor: drawCanvas width:${width} height:${height}`);
      const imgData = ctx.createImageData(width, height);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          const [r, g, b] = pixelData.get(x, y);
          imgData.data[index] = r;
          imgData.data[index + 1] = g;
          imgData.data[index + 2] = b;
          imgData.data[index + 3] = 255; // Alpha channel
        }
      }
      ctx.putImageData(imgData, 0, 0);
    };

    // Initialize the canvas with the default pixel data
    // drawCanvas(ctx);

    const handlePointerDown = (e: PointerEvent) => {
      console.log(`CanvasEditor${id}: handlePointerDown: e: `, e);
      setIsDrawing(true);
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / (rect.width / width));
      const y = Math.floor((e.clientY - rect.top) / (rect.height / height));
      setLastPos({ x, y });
      handlePointerEvent(e);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDrawing) return;
      console.log("CanvasEditor: handlePointerMove: e: ", e);
      handlePointerEvent(e);
    };

    const handlePointerUp = (e: PointerEvent) => {
      console.log("CanvasEditor: handlePointerUp: e: ", e);
      setIsDrawing(false);
      setLastPos(null);
    };

    const handlePointerEvent = (e: PointerEvent) => {
      console.log("CanvasEditor: handlePointerEvent: e: ", e);
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / (rect.width / width));
      const y = Math.floor((e.clientY - rect.top) / (rect.height / height));

      if (lastPos) {
        ctx.beginPath();
        ctx.moveTo(lastPos.x, lastPos.y);
        ctx.lineTo(x, y);
        ctx.strokeStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        ctx.globalAlpha = 1.0; // Ensure full opacity for each stroke
        ctx.stroke();
        // Log the current stroke style and alpha value
        console.log(
          `Current stroke style: ${ctx.strokeStyle}, globalAlpha: ${ctx.globalAlpha}`
        );
      }

      setLastPos({ x, y });
      pixelData.set(x, y, color);
      console.log("CanvasEditor: handlePointerEvent: color: ", color);
      // Notify parent of state change
      if (onStateChange) {
        onStateChange(pixelData.state);
      }

      // drawCanvas(ctx);
    };

    // Function to draw from given PixelDataCRDT object
    const drawFromPixelData = (
      ctx: CanvasRenderingContext2D,
      pixelData: PixelDataCRDT
    ) => {
      console.log(
        `CanvasEditor: drawFromPixelData width:${width} height:${height}`
      );
      const imgData = ctx.createImageData(width, height);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          const [r, g, b] = pixelData.get(x, y);
          imgData.data[index] = r;
          imgData.data[index + 1] = g;
          imgData.data[index + 2] = b;
          imgData.data[index + 3] = 255; // Alpha channel
        }
      }
      ctx.putImageData(imgData, 0, 0);
    };
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointerleave", handlePointerUp);

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointerleave", handlePointerUp);
    };
  }, [isDrawing, lastPos, color, pixelData, onStateChange, width, height]);

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

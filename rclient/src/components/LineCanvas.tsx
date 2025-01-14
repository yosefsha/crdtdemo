import React, { useEffect, useRef } from "react";

interface LineProps {
  x1: number; // Start point X
  y1: number; // Start point Y
  x2: number; // End point X
  y2: number; // End point Y
  width?: number; // Canvas width
  height?: number; // Canvas height
  lineColor?: string; // Line color
  lineWidth?: number; // Line width
}

const LineCanvas: React.FC<LineProps> = ({
  x1,
  y1,
  x2,
  y2,
  width = 300,
  height = 300,
  lineColor = "black",
  lineWidth = 2,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    console.log(
      "LineCanvas: useEffect: lineColor: ",
      lineColor,
      "lineWidth: ",
      lineWidth
    );
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.beginPath();
        ctx.fillStyle = "#ff6";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Set line properties
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = lineWidth;

        // Draw the line
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
  }, [x1, y1, x2, y2, lineColor, lineWidth]);

  return <canvas ref={canvasRef} width={width} height={height} />;
};

export default LineCanvas;

import React, { useMemo, useState, useRef } from "react";
import { RGB, PixelDataCRDT, PixelDeltaPacket } from "../crdt/PixelDataCRDT";
import CanvasEditor from "./CanvasEditor";
import css from "../styles/CRDTDemo.module.css";
import config from "../config";
import { useSelector } from "react-redux";
import type { RootState } from "../store";

const CRDTDemo = () => {
  const width = 200;
  const height = 200;
  const [sharedState, setSharedState] = useState(0);
  const [color, setColor] = useState<RGB | null>([0, 0, 0]); // Default color
  const [isEraser, setIsEraser] = useState(false); // Eraser mode
  const [loginPromptActive, setLoginPromptActive] = useState(false);
  const currentColorRef = useRef<RGB | null>(color);
  const pixelData1 = useMemo(() => new PixelDataCRDT("pixelData1"), []); // Created only once
  const pixelData2 = useMemo(() => new PixelDataCRDT("pixelData2"), []);
  const { user, token, status, error } = useSelector(
    (state: RootState) => state.auth
  );

  React.useEffect(() => {
    if (token) {
      console.log("CRDTDemo: Got token:", token);
    }
  }, [token]);

  const handleStateChange = async (deltaPacket: PixelDeltaPacket) => {
    if (!token) {
      console.error("CRDTDemo: No JWT token available. Request aborted.");
      setLoginPromptActive(true);
      return;
    }
    setLoginPromptActive(false);
    console.log(
      `CRDTDemo: handleStateChange: will send ${deltaPacket.deltas.length} deltas of agent ${deltaPacket.agentId} to ${config.apiDomain}/api/sync `
    );

    try {
      const response = await fetch(`${config.apiDomain}/api/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ deltas: deltaPacket }),
      });

      if (response.ok) {
        const responseData = await response.json();
        const serverDeltas = responseData.deltas as PixelDeltaPacket;
        console.log(
          `CRDTDemo: handleStateChange: server deltas count: `,
          serverDeltas.deltas.length
        );
        pixelData2.merge(serverDeltas);
        pixelData1.merge(serverDeltas);
        setSharedState((prev) => prev + 1);
      } else {
        console.error("Failed to sync with server");
      }
    } catch (error) {
      console.error("Error syncing with server:", error);
    }
  };

  /** Handles eraser mode change */
  const handleEraserChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsEraser(event.target.checked);
    console.log(
      "CRDTDemo: handleEraserChange: isEraser: ",
      event.target.checked
    );
    if (event.target.checked) {
      setColor(null); // Set color to white when eraser is enabled
    } else {
      // Set color back to previous color
      setColor(currentColorRef.current);
    }
  };

  /** Extracts the RGB values from a hex color string. */
  function parseHexToRGB(hexColor: string): RGB | null {
    // Remove the leading '#' and extract hex pairs
    const hex = hexColor.substring(1).match(/[\da-f]{2}/g);
    return hex ? (hex.map((byte) => parseInt(byte, 16)) as RGB) : null;
  }

  /** Handles color change from the input */
  const handleColorChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    currentColorRef.current = parseHexToRGB(event.target.value);
    if (currentColorRef.current) {
      console.log(
        "CRDTDemo: handleColorChange: set color: ",
        currentColorRef.current
      );
      setColor(currentColorRef.current);
    }
  };

  return (
    <div className={css.wrapper}>
      <div className={css.canvases}>
        <CanvasEditor
          id="alice"
          width={width}
          height={height}
          color={color}
          pixelData={pixelData1}
          onStateChange={handleStateChange}
          sharedState={sharedState}
          cursor={isEraser ? "crosshair" : "default"} // Change cursor based on isEraser
        />
        <CanvasEditor
          id="bob"
          width={width}
          height={height}
          color={color}
          pixelData={pixelData2}
          onStateChange={handleStateChange}
          sharedState={sharedState}
          cursor={isEraser ? "crosshair" : "default"} // Change cursor based on isEraser
        />
      </div>
      <div className={css.controls}>
        <input type="color" onChange={handleColorChange} />
        <label>
          <input
            type="checkbox"
            checked={isEraser}
            onChange={handleEraserChange}
          />
          Eraser
        </label>
      </div>
      {token && (
        <div className={css.userInfo}>
          <p>Logged in as: {user?.email || "User"}</p>
          <p>Status: {status}</p>
          {error && <p className={css.error}>Error: {error}</p>}
        </div>
      )}
      {!token && (
        <div
          className={
            loginPromptActive
              ? `${css.loginPrompt} ${css.highlight}`
              : css.loginPrompt
          }
        >
          <p>Please log in to access the drawing tools.</p>
        </div>
      )}
    </div>
  );
};

export default CRDTDemo;

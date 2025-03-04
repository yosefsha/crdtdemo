import React, { useEffect, useMemo, useState } from "react";
import { State } from "../crdt/CRDTTypes";
import {
  RGB,
  PixelDataCRDT,
  PixelDelta,
  PixelDeltaPacket,
} from "../crdt/PixelDataCRDT";
import CanvasEditor from "./CanvasEditor";
import css from "../styles/CRDTDemo.module.css";
import config from "../config";

const CRDTDemo = () => {
  const width = 200;
  const height = 200;
  const [sharedState, setSharedState] = useState(0);
  const [color, setColor] = useState<RGB>([0, 0, 0]); // Default color
  const pixelData1 = useMemo(() => new PixelDataCRDT("pixelData1"), []); // Created only once
  const pixelData2 = useMemo(() => new PixelDataCRDT("pixelData2"), []);

  const handleStateChange = async (deltaPacket: PixelDeltaPacket) => {
    console.log(
      `CRDTDemo: handleStateChange: will send ${deltaPacket.deltas.length} deltas of agent ${deltaPacket.agentId} to ${config.apiDomain}/api/sync `
    );

    try {
      const response = await fetch(`${config.apiDomain}/api/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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

  /** Extracts the RGB values from a hex color string. */
  function parseHexToRGB(hexColor: string): RGB | null {
    // Remove the leading '#' and extract hex pairs
    const hex = hexColor.substring(1).match(/[\da-f]{2}/g);
    return hex ? (hex.map((byte) => parseInt(byte, 16)) as RGB) : null;
  }

  /** Handles color change from the input */
  const handleColorChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const rgb = parseHexToRGB(event.target.value);
    if (rgb) {
      console.log("CRDTDemo: handleColorChange: set color: ", rgb);
      setColor(rgb);
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
        />
        <CanvasEditor
          id="bob"
          width={width}
          height={height}
          color={color}
          pixelData={pixelData2}
          onStateChange={handleStateChange}
          sharedState={sharedState}
        />
      </div>
      <div className={css.controls}>
        <input type="color" onChange={handleColorChange} />
      </div>
    </div>
  );
};

export default CRDTDemo;

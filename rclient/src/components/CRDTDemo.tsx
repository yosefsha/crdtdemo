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

const CRDTDemo = () => {
  const width = 200;
  const height = 200;
  const [sharedState, setSharedState] = useState(0);
  const [color, setColor] = useState<RGB>([0, 0, 0]); // Default color
  const pixelData1 = useMemo(() => new PixelDataCRDT("pixelData1"), []); // Created only once
  const pixelData2 = useMemo(() => new PixelDataCRDT("pixelData2"), []);

  //   useEffect(() => {
  //     console.log("Parent Component Rendered - pixelData:", pixelData1);
  //   }, [pixelData1]);

  // Draw a diagonal line from top-left to bottom-right
  //   for (let i = 0; i < Math.min(width, height); i++) {
  //     pixelData2.set(i, i, [0, 0, 0]); // Set the line color to black
  //   }

  ////
  // const handleStateChange = (state: State<RGB>) => {
  //   console.log("CRDTDemo: handleStateChange: set shared state: ", state);
  //   setSharedState(state);
  // };
  const handleStateChange = (deltasPacket: PixelDeltaPacket) => {
    console.log(
      "CRDTDemo: handleStateChange: received deltas of ",
      deltasPacket.agentId,
      " pixels"
    );
    pixelData1.merge(deltasPacket);
    pixelData2.merge(deltasPacket);
    setSharedState((prev) => prev + 1);
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
      <input type="color" onChange={handleColorChange} />
    </div>
  );
};

export default CRDTDemo;

import React, { useState } from "react";
import { State } from "../crdt/CRDTTypes";
import { RGB, PixelDataCRDT } from "../crdt/PixelDataCRDT";
import CanvasEditor from "./CanvasEditor";
import css from "../styles/CRDTDemo.module.css";

const CRDTDemo = () => {
  const width = 200;
  const height = 200;
  const [sharedState, setSharedState] = useState<State<RGB>>({});
  const [color, setColor] = useState<RGB>([0, 0, 0]); // Default color
  const pixelData1 = new PixelDataCRDT("pixelDataId");
  const pixelData2 = new PixelDataCRDT("pixelDataId");

  const handleStateChange = (state: State<RGB>) => {
    setSharedState(Object.assign({}, state));
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
          onStateChange={handleStateChange}
          color={color}
          pixelData={pixelData1}
        />
        <CanvasEditor
          id="bob"
          width={width}
          height={height}
          onStateChange={handleStateChange}
          color={color}
          pixelData={pixelData2}
        />
      </div>
      <input type="color" onChange={handleColorChange} />
    </div>
  );
};

export default CRDTDemo;

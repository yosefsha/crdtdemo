import React from "react";
import LineCanvas from "./LineCanvas";

function LineDmo() {
  return (
    <div>
      <h1>Draw a Line in React</h1>
      {/* Example: Draw a line from (50, 50) to (250, 200) */}
      <LineCanvas
        x1={50}
        y1={50}
        x2={250}
        y2={200}
        lineColor="blue"
        lineWidth={16}
      />
    </div>
  );
}

export default LineDmo;

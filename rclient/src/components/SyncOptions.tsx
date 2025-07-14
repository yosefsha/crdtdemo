import React, { useState } from "react";

/**
 * SyncOptions component: Three radio buttons for sync options.
 * 1. Sync Remote
 * 2. Sync Other User
 * 3. Enrich
 */
interface SyncOptionsProps {
  name: string;
  value?: SyncOption; // Optional value prop for controlled component
  onChange?: (value: SyncOption) => void; // Optional onChange prop for
}
export type SyncOption = "remote" | "enrich" | "otherUser";

const SyncOptions: React.FC<SyncOptionsProps> = ({ name }) => {
  const [selected, setSelected] = useState<SyncOption>("remote");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <input
          type="radio"
          name={name}
          value="remote"
          checked={selected === "remote"}
          onChange={() => setSelected("remote")}
        />
        <span style={{ fontSize: 12, marginTop: 4 }}>1. Sync Remote</span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <input
          type="radio"
          name={name}
          value="otherUser"
          checked={selected === "otherUser"}
          onChange={() => setSelected("otherUser")}
        />
        <span style={{ fontSize: 12, marginTop: 4 }}>2. Sync Other User</span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <input
          type="radio"
          name={name}
          value="enrich"
          checked={selected === "enrich"}
          onChange={() => setSelected("enrich")}
        />
        <span style={{ fontSize: 12, marginTop: 4 }}>3. Enrich</span>
      </div>
    </div>
  );
};

export default SyncOptions;

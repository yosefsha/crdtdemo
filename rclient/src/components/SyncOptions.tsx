import React from "react";

/**
 * SyncOptions component: Three radio buttons for sync options.
 * 1. Sync Remote
 * 2. Sync Other User
 * 3. Enrich
 */
interface SyncOptionsProps {
  name: string;
  value: SyncOption; // required
  onChange: (value: SyncOption) => void; // required
}
export type SyncOption = "remote" | "enrich" | "otherUser";

const SyncOptions: React.FC<SyncOptionsProps> = ({ name, value, onChange }) => (
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
        checked={value === "remote"}
        onChange={() => onChange("remote")}
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
        checked={value === "otherUser"}
        onChange={() => onChange("otherUser")}
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
        checked={value === "enrich"}
        onChange={() => onChange("enrich")}
      />
      <span style={{ fontSize: 12, marginTop: 4 }}>3. Enrich</span>
    </div>
  </div>
);

export default SyncOptions;

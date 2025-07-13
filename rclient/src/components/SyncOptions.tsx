import React, { useState } from "react";

/**
 * SyncOptions component: Three radio buttons for sync options.
 * 1. Sync Remote
 * 2. Sync Other User
 * 3. Enrich
 */
interface SyncOptionsProps {
  name: string;
}

const SyncOptions: React.FC<SyncOptionsProps> = ({ name }) => {
  const [selected, setSelected] = useState("sync-remote");

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
          value="sync-remote"
          checked={selected === "sync-remote"}
          onChange={() => setSelected("sync-remote")}
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
          value="sync-other-user"
          checked={selected === "sync-other-user"}
          onChange={() => setSelected("sync-other-user")}
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

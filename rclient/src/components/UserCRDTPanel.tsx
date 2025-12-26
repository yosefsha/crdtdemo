import React, { useMemo, useRef } from "react";
import { getTimestamp } from "../helpers";
import AuthPage from "./AuthPage";
import CanvasEditor, { toBase64Image } from "./CanvasEditor";
import { MergeResult, PixelDocument, PixelDeltaPacket } from "@crdtdemo/shared";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { useUserAuthContext } from "./UserAuthContext";
import config from "../config";
import SyncOptions from "./SyncOptions";
import { SyncOption } from "./SyncOptions";
import type { AppUser } from "../types/app";
import { io, Socket } from "socket.io-client";
// TEST: Import from shared to verify compilation
import { CRDTDatabase } from "@crdtdemo/shared";

// Canvas and CRDT dimension constants
const CANVAS_WIDTH = 200;
const CANVAS_HEIGHT = 200;
const CRDT_WIDTH = 512; // High resolution for enhanced images
const CRDT_HEIGHT = 512;

interface UserCRDTPanelProps {
  // pixelData: PixelDataCRDT;
  otherUserId: string; // Add this line
  onLoggedInUserId: (userId: string) => void;
}

const UserCRDTPanel: React.FC<UserCRDTPanelProps> = ({
  otherUserId,
  onLoggedInUserId, // Callback to notify parent of logged-in user ID
}) => {
  const { sliceKey } = useUserAuthContext();

  // user should be of type AppUser | undefined
  const { user, token } = useSelector(
    (state: RootState) =>
      (state as any)[sliceKey] as { user?: AppUser; token?: string }
  );

  // Use empty string for userId if not present (e.g., before registration)
  const {
    userId,
    email: userEmail,
    name: userName,
  } = user || { userId: "", email: "", name: "" };

  const replicaId = useMemo(
    () => `${userId}_client`, // Use userId for consistency
    [userId]
  );
  const serverReplicaId = useMemo(
    () => `${userId}_server`, // Use userId for server replica
    [userId]
  );
  const pixelData = useMemo(
    () => new PixelDocument(userId, replicaId),
    [userId, replicaId]
  );

  const socket = useRef<WebSocket | null>(null);
  const canvasEditorRef = useRef<{
    fromBase64Image: (crdt: PixelDocument, base64: string) => void;
  } | null>(null);

  React.useEffect(() => {
    console.debug(
      `[${getTimestamp()}] [DEBUG] UserCRDTPanel: user object:`,
      user
    );
    setSharedState((s) => s + 1); // Force re-render when user changes
  }, [user]);

  React.useEffect(() => {
    if (userId) {
      onLoggedInUserId(userId);
    }
  }, [userId, onLoggedInUserId]);

  React.useEffect(() => {
    console.info(
      `[${getTimestamp()}] [INFO] UserCRDTPanel: Rendered for sliceKey:`,
      sliceKey
    );
  }, [sliceKey]);

  React.useEffect(() => {
    async function syncFromServer() {
      if (!token) return;
      try {
        console.info(
          `[${getTimestamp()}] [INFO] CRDTDemoPage: ${sliceKey} Got token:`,
          token
        );
        const res = await fetch(`${config.apiDomain}/sync`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) {
          const err = await res.json();
          throw err;
        }
        const data = await res.json();
        console.debug(
          `[${getTimestamp()}] [DEBUG] Loaded user CRDT from server:`,
          data
        );

        pixelData.merge(data.deltas); // Merge deltas into pixelData
        console.info(
          `[${getTimestamp()}] [INFO] UserCRDTPanel: Merged deltas from server`
        );

        setSharedState((s) => s + 1); // Always force re-render after sync attempt
      } catch (err) {
        console.error(
          `[${getTimestamp()}] [ERROR] Failed to load user CRDT from server`,
          err
        );
      }
    }
    syncFromServer();
  }, [token, pixelData]);

  const [sharedState, setSharedState] = React.useState(0);

  // Store the list of users from the backend
  // Add 'replica' to SyncOption type if you want to support intra-agent sync in the UI
  const [syncOption, setSyncOption] = React.useState<SyncOption>("remote");
  type SyncType = "agent" | "replica";
  // Function to handle sync response from the server or peer
  function handleSyncResponse(
    syncType: SyncType,
    resData: MergeResult | null = null,
    agentId?: string,
    replicaId?: string
  ): PixelDeltaPacket | null {
    console.debug(
      `[${getTimestamp()}] [DEBUG] [${syncType}] Handle sync response:`,
      resData
    );
    console.info(
      `[${getTimestamp()}] [INFO] [${syncType}] Merging deltas into local CRDT`
    );
    let res: PixelDeltaPacket | null = null;
    if (resData) {
      if (syncType === "agent" && agentId) {
        res = pixelData.handleMergeAgentResult(resData, agentId); // agent-level merge
      } else if (syncType === "replica" && replicaId) {
        res = pixelData.handleMergeReplicaResult(resData, replicaId); // replica-level merge
      }
      setSharedState((s) => s + 1);
    }
    return res;
  }

  // Inter-agent sync (with server or other agent)
  async function handleRemoteSync() {
    if (token) {
      try {
        // Get only the deltas that the server (other agent) hasn't acknowledged yet
        const deltaPacket = pixelData.getDeltaForReplica(serverReplicaId);
        console.info(
          `[${getTimestamp()}] [INFO] [remote] Sending replica-level deltas to server:`,
          deltaPacket
        );
        const res = await fetch(`${config.apiDomain}/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ deltas: deltaPacket }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw err;
        }
        const data = await res.json();
        const morePacket = handleSyncResponse(
          "agent",
          data,
          undefined,
          serverReplicaId
        );
        if (morePacket) {
          handleRemoteSync(); // Recursively handle any additional deltas
        }
        console.info(
          `[${getTimestamp()}] [INFO] [remote] Agent-level sync complete`
        );
      } catch (err) {
        console.error(
          `[${getTimestamp()}] [ERROR] Failed to sync agent-level deltas to server`,
          err
        );
      }
    }
  }

  // Inter-agent sync (with another user/agent)
  async function handleOtherUserSync() {
    await handleRemoteSync(); // Ensure we sync with server first
    if (token && otherUserId) {
      try {
        const deltaPacket = pixelData.getDeltaForAgent(otherUserId);
        const reqData = {
          deltas: deltaPacket,
          targetUser: otherUserId,
        };
        const res = await fetch(`${config.apiDomain}/sync-from-other`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(reqData),
        });
        if (!res.ok) {
          const err = await res.json();
          throw err;
        }
        const resData = await res.json();
        // handleSyncResponse("agent", resData.data, otherUserId);
        pixelData.merge(resData.data); // Merge deltas into pixelData
        setSharedState((s) => s + 1); // Force re-render after sync
        console.debug(
          `[${getTimestamp()}] [DEBUG] Merged deltas from other user:`,
          resData.data
        );
        console.info(
          `[${getTimestamp()}] [INFO] [otherUser] Agent-level sync to other user complete`
        );
      } catch (err) {
        console.error(
          `[${getTimestamp()}] [ERROR] Failed to sync agent-level deltas to other user via server`,
          err
        );
      }
    } else {
      console.warn(
        `[${getTimestamp()}] [WARN] No other user specified for sync`
      );
    }
  }

  async function handleEnrichSync() {
    const base64 = toBase64Image(pixelData, CRDT_WIDTH, CRDT_HEIGHT);
    console.info(
      `[${getTimestamp()}] Generated base64 for enrichment:`,
      "Dimensions:",
      `${CRDT_WIDTH}x${CRDT_HEIGHT}`,
      "Length:",
      base64.length,
      "Size (MB):",
      (base64.length / 1024 / 1024).toFixed(2)
    );
    const requestId = `${userId}_${Date.now()}`;
    const socket: Socket = io("/", { path: config.socketPath });

    socket.on("connect", async () => {
      try {
        const res = await fetch("/api/enrich", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ base64, requestId, socketId: socket.id }),
        });
        if (!res.ok) {
          console.error(
            `[${getTimestamp()}] Enrichment request failed:`,
            res.status,
            res.statusText
          );
          socket.disconnect();
          return;
        }
      } catch (error) {
        console.error(
          `[${getTimestamp()}] Error sending enrichment request:`,
          error
        );
        socket.disconnect();
      }
    });

    socket.on("enrichment-result", async (data) => {
      if (data.requestId === requestId) {
        console.info(
          `[${getTimestamp()}] enrichment result received:`,
          "Type:",
          typeof data.enrichedData,
          "Length:",
          data.enrichedData?.length,
          "Size (MB):",
          data.enrichedData?.length
            ? (data.enrichedData.length / 1024 / 1024).toFixed(2)
            : "N/A",
          "Value preview:",
          data.enrichedData?.substring
            ? data.enrichedData.substring(0, 50) + "..."
            : data.enrichedData
        );

        if (!data.enrichedData || typeof data.enrichedData !== "string") {
          console.error(
            `[${getTimestamp()}] Invalid enrichment data received:`,
            data.enrichedData
          );
          socket.disconnect();
          return;
        }
        // Log CRDT size before applying enrichment
        const crdtSizeBefore = pixelData.getSize();
        console.info(
          `[${getTimestamp()}] CRDT state before enrichment: ${crdtSizeBefore} pixels`
        );

        // Use the existing pixelData instead of creating a new one
        canvasEditorRef.current?.fromBase64Image(pixelData, data.enrichedData);
        // TODO: fix this log !!!

        // Log CRDT size after applying enrichment
        const crdtSizeAfter = pixelData.getSize();
        console.info(
          `[${getTimestamp()}] CRDT state after enrichment: ${crdtSizeAfter} pixels (change: +${crdtSizeAfter - crdtSizeBefore})`
        );

        console.info(`[${getTimestamp()}] enrichment result applied to canvas`);
        setSharedState((s) => s + 1);
        socket.disconnect();
      }
    });

    socket.on("connect_error", (err) => {
      console.error(`[${getTimestamp()}] Socket connection error:`, err);
      socket.disconnect();
    });
  }

  function handleStateChange() {
    console.info(
      `[${getTimestamp()}] [INFO] UserCRDTPanel:${sliceKey} - Selected sync option:`,
      syncOption
    );

    // No need to apply deltas locally; CanvasEditor already updates pixelData.
    switch (syncOption) {
      case "remote":
        handleRemoteSync();
        break;
      case "enrich":
        handleEnrichSync();
        break;
      case "otherUser":
        handleOtherUserSync();
        break;
      default:
        console.error(
          `[${getTimestamp()}] [ERROR] Unknown sync option:`,
          syncOption
        );
        break;
    }
    // BroadcastChannel logic removed as requested
  }

  return (
    <>
      {userName ? <h2>{userName}&apos;s Page</h2> : null}
      <AuthPage />
      <SyncOptions
        name={`syncOption-${sliceKey}`}
        value={syncOption}
        onChange={(val: SyncOption) => setSyncOption(val)}
      />
      <CanvasEditor
        ref={canvasEditorRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        color={"000000ff"}
        pixelData={pixelData}
        onStateChange={token ? handleStateChange : () => {}}
        sharedState={sharedState}
        cursor="default"
      />
    </>
  );
};

export default UserCRDTPanel;

import React, { useMemo, useRef } from "react";
import { getTimestamp } from "../helpers";
import AuthPage from "./AuthPage";
import CanvasEditor, { toBase64Image } from "./CanvasEditor";
import { MergeResult, PixelDocument, PixelDeltaPacket } from "@crdtdemo/shared";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { useUserAuthContext } from "./UserAuthContext";
import config from "../config";
import type { AppUser } from "../types/app";
import { io, Socket } from "socket.io-client";
import { sendWithBatching } from "../services/batchService";
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
        // Acknowledge that we received the server's data so vector clocks are updated
        pixelData.handleMergeReplicaResult(
          { applied: {}, missing: {} },
          serverReplicaId
        );
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

  // Prevent concurrent sync operations
  const syncInProgressRef = React.useRef(false);

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

    // Log the current CRDT size BEFORE handling response
    const sizeBefore = pixelData.getSize();
    console.info(
      `[${getTimestamp()}] [INFO] [${syncType}] CRDT size BEFORE handling response: ${sizeBefore} pixels`
    );

    console.info(
      `[${getTimestamp()}] [INFO] [${syncType}] Merging deltas into local CRDT`
    );
    let res: PixelDeltaPacket | null = null;
    if (resData) {
      // Log what we're about to acknowledge
      const appliedCount = Object.values(resData.applied || {}).reduce(
        (sum, arr) => sum + arr.length,
        0
      );
      const missingCount = Object.values(resData.missing || {}).reduce(
        (sum, arr) => sum + arr.length,
        0
      );
      console.info(
        `[${getTimestamp()}] [INFO] [${syncType}] Merge result contains: applied=${appliedCount}, missing=${missingCount}`
      );

      if (syncType === "agent" && agentId) {
        res = pixelData.handleMergeAgentResult(resData, agentId); // agent-level merge
      } else if (syncType === "replica" && replicaId) {
        res = pixelData.handleMergeReplicaResult(resData, replicaId); // replica-level merge
      }

      // Log the CRDT size AFTER handling response
      const sizeAfter = pixelData.getSize();
      console.info(
        `[${getTimestamp()}] [INFO] [${syncType}] CRDT size AFTER handling response: ${sizeAfter} pixels (change: ${sizeAfter - sizeBefore})`
      );

      setSharedState((s) => s + 1);
    }
    return res;
  }

  // Inter-agent sync (with server or other agent)
  async function handleRemoteSync() {
    if (syncInProgressRef.current) {
      console.warn(
        `[${getTimestamp()}] [WARN] Sync already in progress, skipping`
      );
      return;
    }

    if (token) {
      syncInProgressRef.current = true;
      try {
        // Get only the deltas that the server (other agent) hasn't acknowledged yet
        const deltaPacket = pixelData.getDeltaForReplica(serverReplicaId);

        // If no deltas to send, skip sync
        if (!deltaPacket) {
          console.info(
            `[${getTimestamp()}] [INFO] [remote] No new deltas to sync with server`
          );
          return;
        }

        console.info(
          `[${getTimestamp()}] [INFO] [remote] Sending replica-level deltas to server:`,
          deltaPacket
        );

        // Use batching service to automatically handle large payloads
        const data = await sendWithBatching(
          `${config.apiDomain}/sync`,
          "POST",
          {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          { deltas: deltaPacket },
          {
            onBatchComplete: (response, batchIndex) => {
              console.log(
                `[${getTimestamp()}] [INFO] [remote] Batch ${batchIndex + 1} processed`
              );
            },
          }
        );

        // Process the server's response and acknowledge the sync
        handleSyncResponse("replica", data.data, undefined, serverReplicaId);

        console.info(
          `[${getTimestamp()}] [INFO] [remote] Replica-level sync complete`
        );
      } catch (err) {
        console.error(
          `[${getTimestamp()}] [ERROR] Failed to sync agent-level deltas to server`,
          err
        );
      } finally {
        syncInProgressRef.current = false;
      }
    }
  }

  // Inter-agent sync (with another user/agent)
  async function handleOtherUserSync() {
    await handleRemoteSync(); // Ensure we sync with server first
    if (token && otherUserId) {
      try {
        console.info(
          `[${getTimestamp()}] [INFO] [otherUser] Requesting deltas from ${otherUserId}`
        );

        // Request deltas FROM the other user
        const response = await fetch(`${config.apiDomain}/get-from-other`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            sourceUser: otherUserId,
          }),
        });

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        const resData = await response.json();
        const deltaPacket = resData.data;

        if (!deltaPacket) {
          console.info(
            `[${getTimestamp()}] [INFO] [otherUser] No new deltas from ${otherUserId}`
          );
          return;
        }

        console.info(
          `[${getTimestamp()}] [INFO] [otherUser] Received deltas from ${otherUserId}, merging locally`
        );

        // Merge the other user's deltas into our local document
        const mergeResult = pixelData.merge(deltaPacket);

        // Acknowledge that we received and merged the deltas from the other user
        pixelData.handleMergeAgentResult(mergeResult, otherUserId);

        console.debug(`[${getTimestamp()}] [DEBUG] Merge result:`, {
          appliedCount: Object.values(mergeResult.applied).reduce(
            (sum, arr) => sum + arr.length,
            0
          ),
          missingCount: Object.values(mergeResult.missing).reduce(
            (sum, arr) => sum + arr.length,
            0
          ),
        });

        // Send acknowledgment back to server so it can update the source user's vector clocks
        await fetch(`${config.apiDomain}/acknowledge-from-other`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            sourceUser: otherUserId,
            mergeResult: mergeResult,
          }),
        });

        console.info(
          `[${getTimestamp()}] [INFO] [otherUser] Acknowledged receipt to server`
        );

        // Trigger re-render with new data
        setSharedState((s) => s + 1);

        console.info(
          `[${getTimestamp()}] [INFO] [otherUser] Successfully synced from ${otherUserId}`
        );
      } catch (err) {
        console.error(
          `[${getTimestamp()}] [ERROR] Failed to sync from other user`,
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
    if (syncInProgressRef.current) {
      console.warn(
        `[${getTimestamp()}] [WARN] Sync already in progress, skipping enrich`
      );
      return;
    }

    syncInProgressRef.current = true;
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
        // Use batching service to automatically handle large base64 images
        await sendWithBatching(
          "/api/enrich",
          "POST",
          {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          { base64, requestId, socketId: socket.id },
          {
            onBatchComplete: (response, batchIndex) => {
              console.log(
                `[${getTimestamp()}] [INFO] [enrich] Batch ${batchIndex + 1} sent`
              );
            },
          }
        );
        console.info(
          `[${getTimestamp()}] [INFO] [enrich] Enrichment request sent successfully`
        );
      } catch (error) {
        console.error(
          `[${getTimestamp()}] Error sending enrichment request:`,
          error
        );
        socket.disconnect();
        syncInProgressRef.current = false;
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
        syncInProgressRef.current = false;

        // Automatically sync enriched data to server
        console.info(
          `[${getTimestamp()}] [enrich] Auto-syncing enriched data to server...`
        );
        await handleRemoteSync();
        console.info(
          `[${getTimestamp()}] [enrich] Enriched data synced to server`
        );
      }
    });

    socket.on("connect_error", (err) => {
      console.error(`[${getTimestamp()}] Socket connection error:`, err);
      socket.disconnect();
      syncInProgressRef.current = false;
    });
  }

  return (
    <>
      {userName ? <h2>{userName}&apos;s Page</h2> : null}
      <AuthPage />

      {/* Manual sync buttons */}
      <div
        style={{
          margin: "20px 0",
          padding: "15px",
          backgroundColor: "#f5f5f5",
          borderRadius: "8px",
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={handleRemoteSync}
          disabled={!token || syncInProgressRef.current}
          style={{
            padding: "10px 20px",
            fontSize: "14px",
            fontWeight: "bold",
            backgroundColor: token ? "#4CAF50" : "#cccccc",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: token ? "pointer" : "not-allowed",
            transition: "all 0.3s ease",
          }}
          onMouseOver={(e) => {
            if (token) e.currentTarget.style.backgroundColor = "#45a049";
          }}
          onMouseOut={(e) => {
            if (token) e.currentTarget.style.backgroundColor = "#4CAF50";
          }}
        >
          🔄 Sync to Server
        </button>

        <button
          onClick={handleOtherUserSync}
          disabled={!token || !otherUserId || syncInProgressRef.current}
          style={{
            padding: "10px 20px",
            fontSize: "14px",
            fontWeight: "bold",
            backgroundColor: token && otherUserId ? "#2196F3" : "#cccccc",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: token && otherUserId ? "pointer" : "not-allowed",
            transition: "all 0.3s ease",
          }}
          onMouseOver={(e) => {
            if (token && otherUserId)
              e.currentTarget.style.backgroundColor = "#0b7dda";
          }}
          onMouseOut={(e) => {
            if (token && otherUserId)
              e.currentTarget.style.backgroundColor = "#2196F3";
          }}
        >
          👥 Sync from Other User {otherUserId ? `(${otherUserId})` : ""}
        </button>

        <button
          onClick={handleEnrichSync}
          disabled={!token || syncInProgressRef.current}
          style={{
            padding: "10px 20px",
            fontSize: "14px",
            fontWeight: "bold",
            backgroundColor: token ? "#FF9800" : "#cccccc",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: token ? "pointer" : "not-allowed",
            transition: "all 0.3s ease",
          }}
          onMouseOver={(e) => {
            if (token) e.currentTarget.style.backgroundColor = "#e68900";
          }}
          onMouseOut={(e) => {
            if (token) e.currentTarget.style.backgroundColor = "#FF9800";
          }}
        >
          ✨ Enrich Image
        </button>
      </div>

      <CanvasEditor
        ref={canvasEditorRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        color={"000000ff"}
        pixelData={pixelData}
        onStateChange={() => {}} // Removed auto-sync
        sharedState={sharedState}
        cursor="default"
      />
    </>
  );
};

export default UserCRDTPanel;

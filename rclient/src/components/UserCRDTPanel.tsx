import React, { useMemo } from "react";
import { getTimestamp } from "../helpers";
import AuthPage from "./AuthPage";
import CanvasEditor from "./CanvasEditor";
import { PixelDataCRDT, PixelDeltaPacket } from "../crdt/PixelDataCRDT";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { useUserAuthContext } from "./UserAuthContext";
import config from "../config";

import SyncOptions from "./SyncOptions";
import { SyncOption } from "./SyncOptions";

import type { AppUser } from "../types/app";

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
  const pixelData = useMemo(() => new PixelDataCRDT(sliceKey), [token]);

  // Use empty string for userId if not present (e.g., before registration)
  const {
    userId,
    email: userEmail,
    name: userName,
  } = user || { userId: "", email: "", name: "" };

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
        if (data.crdt) {
          const loaded = PixelDataCRDT.fromJSON(data.crdt);
          Object.assign(pixelData, loaded);
        }
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
  const [syncOption, setSyncOption] = React.useState<SyncOption>("remote");

  // Function to handle sync response from the server
  function handleSyncResponse(reqData: any, resData?: any) {
    console.debug(
      `[${getTimestamp()}] [DEBUG] [remote] Handle sync response:`,
      resData
    );
    console.info(
      `[${getTimestamp()}] [INFO] [remote] Merging server deltas into local CRDT`
    );
    // Merge the deltas into the local CRDT
    // Assuming resData contains the deltas in the expected format
    if (!resData || !resData.deltas) {
      pixelData.merge(resData.deltas);
      setSharedState((s) => s + 1); // Force re-render after sync
    }
  }

  async function handleRemoteSync() {
    if (token) {
      try {
        // Get only the deltas that the server hasn't acknowledged yet
        const deltasToSend = pixelData.getDeltaForPeer("server");
        console.info(
          `[${getTimestamp()}] [INFO] [remote] Sending deltas to server:`,
          deltasToSend
        );
        const res = await fetch(`${config.apiDomain}/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ deltas: deltasToSend }),
        });
        console.info(
          `[${getTimestamp()}] [INFO] [remote] Server responded, status:`,
          res.status
        );
        if (!res.ok) {
          const err = await res.json();
          console.error(
            `[${getTimestamp()}] [ERROR] [remote] Server error response:`,
            err
          );
          throw err;
        }
        const data = await res.json();
        console.debug(
          `[${getTimestamp()}] [DEBUG] [remote] Server response data:`,
          data
        );
        // Acknowledge only the deltas that were actually delivered (assume all for now)
        pixelData.ackPeerPixelDeltas("server", deltasToSend.deltas);
        handleSyncResponse(data);
        console.info(`[${getTimestamp()}] [INFO] [remote] Sync complete`);
      } catch (err) {
        console.error(
          `[${getTimestamp()}] [ERROR] Failed to sync deltas to server`,
          err
        );
      }
    }
  }

  async function handleOtherUserSync() {
    if (token && otherUserId) {
      try {
        // Get only the deltas that the other user hasn't acknowledged yet
        const deltasToSend = pixelData.getDeltaForPeer(otherUserId);
        // Debug log before sending to API
        console.debug("[handleOtherUserSync] About to send to API:", {
          deltas: deltasToSend,
          targetUser: otherUserId,
          token: token ? "[present]" : "[missing]",
        });
        console.info(
          `[${getTimestamp()}] [INFO] [otherUser] Sending deltas to other user:`,
          deltasToSend,
          `targetUser: ${otherUserId}`
        );

        // Send deltas to the other user via server API
        const reqData = {
          deltas: deltasToSend,
          targetUser: otherUserId,
        };
        const res = await fetch(`${config.apiDomain}/sync-from-other`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          // Send deltas to the other user
          body: JSON.stringify(reqData),
        });
        if (!res.ok) {
          const err = await res.json();
          console.error(
            `[${getTimestamp()}] [ERROR] [otherUser] Server error response:`,
            err
          );
          throw err;
        }
        // Optionally handle response (e.g., confirmation)
        const resData = await res.json();
        handleSyncResponse(reqData, resData);
        console.info(
          `[${getTimestamp()}] [INFO] [otherUser] Sync to other user complete`
        );
      } catch (err) {
        console.error(
          `[${getTimestamp()}] [ERROR] Failed to sync deltas to other user via server`,
          err
        );
      }
    } else {
      console.warn(
        `[${getTimestamp()}] [WARN] No other user specified for sync`
      );
    }
  }

  function handleEnrichSync(deltas: PixelDeltaPacket) {
    // Implement enrich sync logic here
  }

  function handleStateChange(deltas: PixelDeltaPacket) {
    console.debug(
      `[${getTimestamp()}] [DEBUG] UserCRDTPanel:${sliceKey} - handleStateChange called with deltas:`,
      deltas
    );

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
        handleEnrichSync(deltas);
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
        id={userName ? userName.toLowerCase() : ""}
        width={200}
        height={200}
        color={[0, 0, 0]}
        pixelData={pixelData}
        onStateChange={token ? handleStateChange : () => {}}
        sharedState={sharedState}
        cursor="default"
      />
    </>
  );
};

export default UserCRDTPanel;

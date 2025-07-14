import React from "react";
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
import UsersDrop from "./UsersDrop";

interface UserCRDTPanelProps {
  pixelData: PixelDataCRDT;
}

const UserCRDTPanel: React.FC<UserCRDTPanelProps> = ({ pixelData }) => {
  const { sliceKey } = useUserAuthContext();
  const { user, token } = useSelector(
    (state: RootState) => (state as any)[sliceKey]
  );

  const userName = user?.username || "";
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

  async function handleRemoteSync(deltas: PixelDeltaPacket) {
    if (token) {
      try {
        console.info(
          `[${getTimestamp()}] [INFO] [remote] Sending deltas to server:`,
          deltas
        );
        const res = await fetch(`${config.apiDomain}/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ deltas }),
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
        if (data && data.deltas) {
          console.info(
            `[${getTimestamp()}] [INFO] [remote] Merging server deltas into local CRDT`
          );
          pixelData.merge(data);
          setSharedState((s) => s + 1); // Force re-render after sync
        }
        console.info(`[${getTimestamp()}] [INFO] [remote] Sync complete`);
      } catch (err) {
        console.error(
          `[${getTimestamp()}] [ERROR] Failed to sync deltas to server`,
          err
        );
      }
    }
  }

  // Store the list of users from the backend
  const [users, setUsers] = React.useState<any[]>([]);
  const [selectedOtherUser, setSelectedOtherUser] = React.useState<string>("");
  const [syncOption, setSyncOption] = React.useState<SyncOption>("remote");

  // Fetch users list on mount
  React.useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch(`${config.apiDomain}/users`);
        if (!res.ok) return;
        const data = await res.json();
        setUsers(data.users || []);
      } catch (err) {
        console.error(`[${getTimestamp()}] [ERROR] Failed to fetch users`, err);
      }
    }
    fetchUsers();
  }, []);

  async function handleOtherUserSync(deltas: PixelDeltaPacket) {
    if (token && selectedOtherUser) {
      try {
        console.info(
          `[${getTimestamp()}] [INFO] [otherUser] Sending deltas to other user:`,
          deltas,
          `targetUser: ${selectedOtherUser}`
        );
        const res = await fetch(`${config.apiDomain}/sync-from-other`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ deltas, targetUser: selectedOtherUser }),
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
        `[${getTimestamp()}] [WARN] No other user selected for sync`
      );
    }
  }

  function handleEnrichSync(deltas: PixelDeltaPacket) {
    // Implement enrich sync logic here
  }

  async function handleStateChange(deltas: PixelDeltaPacket) {
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
        await handleRemoteSync(deltas);
        break;
      case "enrich":
        handleEnrichSync(deltas);
        break;
      case "otherUser":
        await handleOtherUserSync(deltas);
        break;
      default:
        console.error(
          `[${getTimestamp()}] [ERROR] Unknown sync option:`,
          syncOption
        );
        break;
    }
  }

  // Only show UsersDrop if sync option is 'otherUser' and there is at least one other user
  const otherUsers = users.filter(
    (u) => (u.userId || u._id) !== userName.toLowerCase()
  );

  return (
    <>
      {userName ? <h2>{userName}&apos;s Page</h2> : null}
      <AuthPage />
      <SyncOptions
        name={`syncOption-${sliceKey}`}
        value={syncOption}
        onChange={(val: SyncOption) => setSyncOption(val)}
      />
      {syncOption === "otherUser" && otherUsers.length > 0 && (
        <UsersDrop
          users={users}
          userName={userName}
          selectedOtherUser={selectedOtherUser}
          setSelectedOtherUser={setSelectedOtherUser}
          sliceKey={sliceKey}
        />
      )}
      <CanvasEditor
        id={userName.toLowerCase()}
        width={200}
        height={200}
        color={[0, 0, 0]}
        pixelData={pixelData}
        onStateChange={handleStateChange}
        sharedState={sharedState}
        cursor="default"
      />
    </>
  );
};

export default UserCRDTPanel;

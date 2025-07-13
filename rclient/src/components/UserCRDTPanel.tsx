import React from "react";
import AuthPage from "./AuthPage";
import CanvasEditor from "./CanvasEditor";
import { PixelDataCRDT } from "../crdt/PixelDataCRDT";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { useUserAuthContext } from "./UserAuthContext";
import config from "../config";

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
    console.log("UserCRDTPanel: Rendered for sliceKey:", sliceKey);
  }, [sliceKey]);
  React.useEffect(() => {
    if (token) {
      console.log(`CRDTDemoPage: ${sliceKey} Got token:`, token);
      // Fetch user CRDT state from server
      fetch(`${config.apiDomain}/sync`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.json();
            throw err;
          }
          return res.json();
        })
        .then((data) => {
          if (data.crdt) {
            const loaded = PixelDataCRDT.fromJSON(data.crdt);
            Object.assign(pixelData, loaded);
          }
        })
        .catch((err) => {
          console.error("Failed to load user CRDT from server", err);
        });
    }
  }, [token, pixelData]);

  return (
    <>
      <h2>{userName}&apos;s Page</h2>
      <AuthPage />
      <CanvasEditor
        id={userName.toLowerCase()}
        width={200}
        height={200}
        color={[0, 0, 0]}
        pixelData={pixelData}
        onStateChange={() => {}}
        sharedState={0}
        cursor="default"
      />
    </>
  );
};

export default UserCRDTPanel;

import React, { useMemo } from "react";
import AuthPage from "./AuthPage";
import CanvasEditor from "./CanvasEditor";
import { PixelDataCRDT } from "../crdt/PixelDataCRDT";
import { useSelector } from "react-redux";
import type { RootState } from "../store";
import css from "../styles/CRDTDemoPage.module.css";
import { UserAuthProvider } from "./UserAuthContext";

const CRDTDemoPage = () => {
  const { token } = useSelector((state: RootState) => state.authAlice);
  const { user } = useSelector((state: RootState) => state.authAlice);
  const userName = user?.email || user?.username || "User";

  // Separate CRDT state for each user page
  const alicePixelData = useMemo(() => new PixelDataCRDT("alice"), []);
  const bobPixelData = useMemo(() => new PixelDataCRDT("bob"), []);

  return (
    <div className={css.container}>
      <UserAuthProvider sliceKey="authAlice">
        <div className={css.userCard}>
          <h2>{userName}&apos;s Page</h2>
          <AuthPage />
          <CanvasEditor
            id={userName.toLowerCase()}
            width={200}
            height={200}
            color={[0, 0, 0]}
            pixelData={alicePixelData}
            onStateChange={() => {}}
            sharedState={0}
            cursor="default"
          />
        </div>
      </UserAuthProvider>
      <UserAuthProvider sliceKey="authBob">
        <div className={css.userCard}>
          <h2>Other User</h2>
          <AuthPage />
          <CanvasEditor
            id="other"
            width={200}
            height={200}
            color={[0, 0, 0]}
            pixelData={bobPixelData}
            onStateChange={() => {}}
            sharedState={0}
            cursor="default"
          />
        </div>
      </UserAuthProvider>
    </div>
  );
};

export default CRDTDemoPage;

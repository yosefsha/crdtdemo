import React, { useMemo, useState } from "react";
import UserCRDTPanel from "./UserCRDTPanel";
import { PixelDataCRDT } from "../crdt/PixelDataCRDT";

import css from "../styles/CRDTDemoPage.module.css";
import { UserAuthProvider } from "./UserAuthContext";

const CRDTDemoPage = () => {
  // Separate CRDT state for each user page
  const alicePixelData = useMemo(() => new PixelDataCRDT("alice"), []);
  const bobPixelData = useMemo(() => new PixelDataCRDT("bob"), []);

  // State to hold the logged-in user IDs
  const [aliceId, setAliceId] = useState<string>("");
  const [bobId, setBobId] = useState<string>("");

  return (
    <div className={css.container}>
      <UserAuthProvider sliceKey="authAlice">
        <div className={css.userCard}>
          <UserCRDTPanel
            pixelData={alicePixelData}
            otherUserId={bobId}
            onLoggedInUserId={setAliceId}
          />
        </div>
      </UserAuthProvider>
      <UserAuthProvider sliceKey="authBob">
        <div className={css.userCard}>
          <UserCRDTPanel
            pixelData={bobPixelData}
            otherUserId={aliceId}
            onLoggedInUserId={setBobId}
          />
        </div>
      </UserAuthProvider>
    </div>
  );
};

export default CRDTDemoPage;

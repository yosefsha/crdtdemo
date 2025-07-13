import React, { useMemo } from "react";
import UserCRDTPanel from "./UserCRDTPanel";
import { PixelDataCRDT } from "../crdt/PixelDataCRDT";

import css from "../styles/CRDTDemoPage.module.css";
import { UserAuthProvider } from "./UserAuthContext";

const CRDTDemoPage = () => {
  // Separate CRDT state for each user page
  const alicePixelData = useMemo(() => new PixelDataCRDT("alice"), []);
  const bobPixelData = useMemo(() => new PixelDataCRDT("bob"), []);

  return (
    <div className={css.container}>
      <UserAuthProvider sliceKey="authAlice">
        <div className={css.userCard}>
          <UserCRDTPanel pixelData={alicePixelData} />
        </div>
      </UserAuthProvider>
      <UserAuthProvider sliceKey="authBob">
        <div className={css.userCard}>
          <UserCRDTPanel pixelData={bobPixelData} />
        </div>
      </UserAuthProvider>
    </div>
  );
};

export default CRDTDemoPage;

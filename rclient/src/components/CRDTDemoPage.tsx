import React, { useMemo, useState } from "react";
import UserCRDTPanel from "./UserCRDTPanel";

import css from "../styles/CRDTDemoPage.module.css";
import { UserAuthProvider } from "./UserAuthContext";

const CRDTDemoPage = () => {
  // // Separate CRDT state for each user page
  // State to hold the logged-in user IDs
  const [aliceId, setAliceId] = useState<string>("");
  const [bobId, setBobId] = useState<string>("");

  return (
    <div className={css.container}>
      <UserAuthProvider sliceKey="authAlice">
        <div className={css.userCard}>
          <UserCRDTPanel otherUserId={bobId} onLoggedInUserId={setAliceId} />
        </div>
      </UserAuthProvider>
      <UserAuthProvider sliceKey="authBob">
        <div className={css.userCard}>
          <UserCRDTPanel otherUserId={aliceId} onLoggedInUserId={setBobId} />
        </div>
      </UserAuthProvider>
    </div>
  );
};

export default CRDTDemoPage;

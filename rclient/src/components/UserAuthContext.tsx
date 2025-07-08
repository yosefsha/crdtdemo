import React, { useContext, createContext } from "react";

type UserAuthContextType = {
  sliceKey: string;
};

const UserAuthContext = createContext<UserAuthContextType | undefined>(
  undefined
);

export const UserAuthProvider: React.FC<{
  sliceKey: string;
  children: React.ReactNode;
}> = ({ sliceKey, children }) => (
  <UserAuthContext.Provider value={{ sliceKey }}>
    {children}
  </UserAuthContext.Provider>
);

export function useUserAuthContext(): UserAuthContextType {
  const context = useContext(UserAuthContext);
  if (!context) {
    throw new Error(
      "useUserAuthContext must be used within a UserAuthProvider"
    );
  }
  return context;
}

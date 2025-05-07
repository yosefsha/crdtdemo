export interface User {
  jwt: string;
  name: string;
  email: string;
}

export interface UserCredentioals {
  name?: string;
  email: string;
  password: string;
}
export interface AppProps {
  currentUser: User | null;
  auth: boolean;
  setCurrentUser: (user: User | null) => void;
  setAuth: (auth: boolean) => void;
}

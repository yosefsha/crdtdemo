// Central user type for the app
// Central user type for the app, matching backend response
export interface AppUser {
  userId: string; // assigned by server after registration
  email: string;
  name: string;
}

export interface UserCredentials {
  name?: string;
  email: string;
  password: string;
}

// Remove legacy AppProps; per-panel state should be managed via Redux or local state

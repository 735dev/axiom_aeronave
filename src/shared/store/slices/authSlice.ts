import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface AuthUser {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role_id: string;
  role_code: string;
  role_name: string;
  aircraft_id?: string;
  /** El servidor nunca devuelve la imagen de la firma: solo si existe. */
  has_signature?: boolean;
  must_change_password?: boolean;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  permissions: string[];
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  token: null,
  refreshToken: null,
  user: null,
  permissions: [],
  isAuthenticated: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    signedIn(
      state,
      action: PayloadAction<{
        token: string;
        refreshToken?: string;
        user: AuthUser;
        permissions: string[];
      }>,
    ) {
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken ?? null;
      state.user = action.payload.user;
      state.permissions = action.payload.permissions;
      state.isAuthenticated = true;
    },
    tokensRefreshed(state, action: PayloadAction<{ token: string; refreshToken?: string }>) {
      state.token = action.payload.token;
      if (action.payload.refreshToken) state.refreshToken = action.payload.refreshToken;
    },
    setPermissions(state, action: PayloadAction<string[]>) {
      state.permissions = action.payload;
    },
    logout() {
      return initialState;
    },
    updateUser(state, action: PayloadAction<Partial<AuthUser>>) {
      if (state.user) state.user = { ...state.user, ...action.payload };
    },
  },
});

export const { signedIn, logout, updateUser, setPermissions, tokensRefreshed } = authSlice.actions;
export default authSlice.reducer;

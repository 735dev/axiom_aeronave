import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { env } from '@/shared/config/env';

export type ThemeMode = 'light' | 'dark' | 'system';
interface ThemeState {
  mode: ThemeMode;
}
const initialState: ThemeState = { mode: env.defaultTheme };

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<ThemeMode>) {
      state.mode = action.payload;
    },
    toggleTheme(state) {
      state.mode = state.mode === 'dark' ? 'light' : 'dark';
    },
  },
});

export const { setTheme, toggleTheme } = themeSlice.actions;
export default themeSlice.reducer;

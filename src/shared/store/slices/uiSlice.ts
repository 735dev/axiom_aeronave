import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type InfoModalType = 'error' | 'success' | 'warning' | 'confirm';

export interface InfoModalState {
  open: boolean;
  type: InfoModalType;
  code?: number;
  description: string;
  confirmActionId?: string;
  id: number;
}

interface UiState {
  infoModal: InfoModalState;
  globalLoading: boolean;
}

const initialState: UiState = {
  infoModal: { open: false, type: 'error', description: '', id: 0 },
  globalLoading: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    showInfoModal(state, action: PayloadAction<Omit<InfoModalState, 'open' | 'id'>>) {
      state.infoModal = { ...action.payload, open: true, id: Date.now() };
    },
    hideInfoModal(state) {
      state.infoModal.open = false;
    },
    setGlobalLoading(state, action: PayloadAction<boolean>) {
      state.globalLoading = action.payload;
    },
  },
});

export const { showInfoModal, hideInfoModal, setGlobalLoading } = uiSlice.actions;
export default uiSlice.reducer;

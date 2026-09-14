import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  isLoading: boolean;
  theme: 'light' | 'dark' | 'automatic';
}

const initialState: UIState = {
  isLoading: false,
  theme: 'automatic',
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setTheme: (state, action: PayloadAction<UIState['theme']>) => {
      state.theme = action.payload;
    },
  },
});

export const { setLoading, setTheme } = uiSlice.actions;
export default uiSlice.reducer;
export type { UIState };

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ChatState } from './types';
import { fetchUnreadCount } from './thunks';

const initialState: ChatState = {
  unreadCount: 0,
  activeChatKey: null,
  lastReceivedMessage: null,
  isLoading: false,
  error: null,
};

export const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setUnreadCount: (state, action: PayloadAction<number>) => {
      state.unreadCount = Math.max(0, action.payload);
    },
    incrementUnreadCount: (state) => {
      state.unreadCount += 1;
    },
    decrementUnreadCount: (state, action: PayloadAction<number | undefined>) => {
      const amount = action.payload !== undefined ? action.payload : 1;
      state.unreadCount = Math.max(0, state.unreadCount - amount);
    },
    setActiveChatKey: (state, action: PayloadAction<string | null>) => {
      state.activeChatKey = action.payload;
    },
    setLastReceivedMessage: (state, action: PayloadAction<any>) => {
      state.lastReceivedMessage = action.payload;
    },
    clearChatState: (state) => {
      state.unreadCount = 0;
      state.activeChatKey = null;
      state.lastReceivedMessage = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUnreadCount.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.isLoading = false;
        state.unreadCount = action.payload;
      })
      .addCase(fetchUnreadCount.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  setUnreadCount,
  incrementUnreadCount,
  decrementUnreadCount,
  setActiveChatKey,
  setLastReceivedMessage,
  clearChatState,
} = chatSlice.actions;

export { fetchUnreadCount };

export default chatSlice.reducer;


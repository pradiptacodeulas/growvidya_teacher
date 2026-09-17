import { createAsyncThunk } from '@reduxjs/toolkit';
import { apiClient } from '@/services/apiClient';

export const fetchUnreadCount = createAsyncThunk(
  'chat/fetchUnreadCount',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/messages/unread-count');
      const data = response.data;
      const count = Number(data?.data?.unreadCount !== undefined ? data.data.unreadCount : (data?.unreadCount || 0));
      return count;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch unread message count');
    }
  }
);

import { createAsyncThunk } from '@reduxjs/toolkit';
import { apiClient } from '@/services/apiClient';

export const updateProfilePicture = createAsyncThunk(
  "auth/updateProfilePicture",
  async (image: { uri: string; fileName?: string; mimeType?: string }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append("file", {
        uri: image.uri,
        name: image.fileName || "image.jpg",
        type: image.mimeType || "image/jpeg",
      } as any);

      // 1. Upload picture to server upload route
      const uploadRes = await apiClient.post('/upload/single?folder=teacher', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const picturePath =
        uploadRes.data?.data?.file_path ||
        uploadRes.data?.data?.path ||
        uploadRes.data?.data?.url ||
        uploadRes.data?.data?.filename;

      if (!picturePath) {
        throw new Error('Failed to upload image file');
      }

      // 2. Update teacher profile with uploaded picture path
      await apiClient.put('/teacher/auth/profile', { picture: picturePath });

      return picturePath;
    } catch (error: any) {
      return rejectWithValue(error.message || "An unexpected error occurred");
    }
  },
);

export const fetchProfile = createAsyncThunk(
  "auth/fetchProfile",
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/teacher/auth/profile');
      const data = response.data;
      return data?.data?.teacher || data?.data || data;
    } catch (error: any) {
      return rejectWithValue(error.message || "An unexpected error occurred");
    }
  },
);

export const updateProfile = createAsyncThunk(
  "auth/updateProfile",
  async (profileData: any, { rejectWithValue }) => {
    try {
      const response = await apiClient.put('/teacher/auth/profile', profileData);
      const data = response.data;
      return data?.data?.teacher || data?.data || data;
    } catch (error: any) {
      return rejectWithValue(error.message || "An unexpected error occurred");
    }
  },
);



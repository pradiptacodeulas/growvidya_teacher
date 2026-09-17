import { configureStore, combineReducers } from "@reduxjs/toolkit";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAuthToken } from "@/services/apiClient";
import uiReducer from "./features/ui/slice";
import authReducer from "./features/auth/slice";
import dashboardReducer from "./features/dashboard/slice";
import studentReducer from "./features/students/slice";
import chatReducer, { clearChatState } from "./features/chat/slice";

const rootReducer = combineReducers({
  ui: uiReducer,
  auth: authReducer,
  dashboard: dashboardReducer,
  students: studentReducer,
  chat: chatReducer,
});

// Middleware to save user data and theme settings to AsyncStorage
const persistMiddleware = (store: any) => (next: any) => (action: any) => {
  const result = next(action);
  
  if (
    action.type === 'auth/loginSuccess' ||
    action.type === 'auth/updateProfilePicture/fulfilled' ||
    action.type === 'auth/updateProfile/fulfilled' ||
    action.type === 'auth/fetchProfile/fulfilled'
  ) {
    const authState = store.getState()?.auth;
    if (authState?.user) {
      AsyncStorage.setItem('user_data', JSON.stringify(authState.user));
      setAuthToken(authState.token || authState.user.token || null);
    }
  } else if (action.type === 'auth/logout') {
    AsyncStorage.removeItem('user_data');
    setAuthToken(null);
    store.dispatch(clearChatState());
  } else if (action.type === 'ui/setTheme') {
    AsyncStorage.setItem('app_theme', action.payload);
  }
  
  return result;
};

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // Turn off serialization checks to avoid issues with complex objects
    }).concat(persistMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

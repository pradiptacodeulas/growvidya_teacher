import { store } from "@/redux/store";
import { loginSuccess, logout } from "@/redux/features/auth/slice";
import { setTheme } from "@/redux/features/ui/slice";
import { setAuthToken, setOnUnauthorizedCallback } from "@/services/apiClient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { MenuProvider } from "react-native-popup-menu";
import Toast, { ToastConfig, BaseToast, InfoToast } from "react-native-toast-message";
import { Provider } from "react-redux";
import { useAppTheme } from "@/constants/theme";
import GlobalMessageListener from "@/components/GlobalMessageListener";
import InAppChatNotification from "@/components/InAppChatNotification";

import { getMessaging, setBackgroundMessageHandler, RemoteMessage } from '@react-native-firebase/messaging';
import { registerForPushNotificationsAsync } from "@/services/notification.service";

// Top-level background message handler for when app is killed or in background
try {
  const messagingInstance = getMessaging();
  setBackgroundMessageHandler(messagingInstance, async (remoteMessage: RemoteMessage) => {
    console.log('[FCM Background Message Received]:', remoteMessage?.messageId);
  });
} catch (e) {
  console.warn('[FCM Background Handler Init Warning]:', e);
}

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {});

const toastConfig: ToastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: '#10B981',
        borderRadius: 14,
        height: 'auto',
        minHeight: 56,
        paddingVertical: 8,
        backgroundColor: '#FFFFFF',
      }}
      contentContainerStyle={{ paddingHorizontal: 14 }}
      text1Style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}
      text2Style={{ fontSize: 12.5, color: '#4B5563' }}
    />
  ),
  error: (props) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: '#EF4444',
        borderRadius: 14,
        height: 'auto',
        minHeight: 56,
        paddingVertical: 8,
        backgroundColor: '#FFFFFF',
      }}
      contentContainerStyle={{ paddingHorizontal: 14 }}
      text1Style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}
      text2Style={{ fontSize: 12.5, color: '#4B5563' }}
    />
  ),
  warning: (props) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: '#F59E0B',
        borderRadius: 14,
        height: 'auto',
        minHeight: 56,
        paddingVertical: 8,
        backgroundColor: '#FFFFFF',
      }}
      contentContainerStyle={{ paddingHorizontal: 14 }}
      text1Style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}
      text2Style={{ fontSize: 12.5, color: '#4B5563' }}
    />
  ),
  info: (props) => (
    <InfoToast
      {...props}
      style={{
        borderLeftColor: '#3B82F6',
        borderRadius: 14,
        height: 'auto',
        minHeight: 56,
        paddingVertical: 8,
        backgroundColor: '#FFFFFF',
      }}
      contentContainerStyle={{ paddingHorizontal: 14 }}
      text1Style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}
      text2Style={{ fontSize: 12.5, color: '#4B5563' }}
    />
  ),
  chat_message: ({ text1, text2, props, onPress }) => (
    <InAppChatNotification
      senderName={text1}
      message={text2}
      avatarUrl={props?.avatarUrl}
      senderRole={props?.senderRole}
      time={props?.time || 'Just now'}
      onPress={onPress}
      onClose={() => Toast.hide()}
    />
  ),
};

function RootAppContent() {
  const { colors } = useAppTheme();

  useEffect(() => {
    setOnUnauthorizedCallback(() => {
      try {
        store.dispatch(logout());
      } catch (err) {
        console.warn('Failed to dispatch logout on 401:', err);
      }
      try {
        router.replace('/(auth)/login');
      } catch (err) {
        console.warn('Failed to redirect to login on 401:', err);
      }
      try {
        Toast.show({
          type: 'error',
          text1: 'Session Expired',
          text2: 'Please log in again to continue.',
        });
      } catch (err) {
        console.warn('Failed to show session expired toast on 401:', err);
      }
    });

    return () => {
      setOnUnauthorizedCallback(null);
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={colors.statusBarStyle} />
      <GlobalMessageListener />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Toast config={toastConfig} />
    </View>
  );
}

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Manually load user data and theme settings from local storage on startup
        const savedUserStr = await AsyncStorage.getItem('user_data');
        const dedicatedToken = await AsyncStorage.getItem('@auth_token');
        if (savedUserStr) {
          try {
            const userData = JSON.parse(savedUserStr);
            if (userData && typeof userData === 'object') {
              const token = dedicatedToken || userData.token || userData.data?.token;
              if (token) {
                setAuthToken(token);
                userData.token = token;
              }
              store.dispatch(loginSuccess(userData));
              registerForPushNotificationsAsync().catch(() => {});
            }
          } catch (parseErr) {
            console.warn('Corrupted user_data in AsyncStorage, removing:', parseErr);
            await AsyncStorage.removeItem('user_data');
          }
        }

        const savedTheme = (await AsyncStorage.getItem('app_theme')) || (await AsyncStorage.getItem('@app_theme_mode'));
        if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'automatic') {
          store.dispatch(setTheme(savedTheme as any));
        } else {
          store.dispatch(setTheme('light'));
          await AsyncStorage.setItem('app_theme', 'light');
        }
      } catch (e) {
        console.warn('Failed to load user data from local storage:', e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  useEffect(() => {
    if (appIsReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <Provider store={store}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheetModalProvider>
          <MenuProvider>
            <RootAppContent />
          </MenuProvider>
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </Provider>
  );
}

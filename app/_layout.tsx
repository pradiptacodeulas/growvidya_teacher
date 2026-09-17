import AnimatedSplashScreen from "@/components/AnimatedSplashScreen";
import { store } from "@/redux/store";
import { loginSuccess } from "@/redux/features/auth/slice";
import { setTheme } from "@/redux/features/ui/slice";
import { setAuthToken } from "@/services/apiClient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { MenuProvider } from "react-native-popup-menu";
import Toast, { ToastConfig } from "react-native-toast-message";
import { Provider } from "react-redux";
import { useAppTheme } from "@/constants/theme";
import GlobalMessageListener from "@/components/GlobalMessageListener";
import InAppChatNotification from "@/components/InAppChatNotification";

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

const toastConfig: ToastConfig = {
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
  const [splashAnimationFinished, setSplashAnimationFinished] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Manually load user data and theme settings from local storage on startup
        const savedUserStr = await AsyncStorage.getItem('user_data');
        if (savedUserStr) {
          try {
            const userData = JSON.parse(savedUserStr);
            if (userData && typeof userData === 'object') {
              const token = userData.token || userData.data?.token;
              if (token) {
                setAuthToken(token);
              }
              store.dispatch(loginSuccess(userData));
            }
          } catch (parseErr) {
            console.warn('Corrupted user_data in AsyncStorage, removing:', parseErr);
            await AsyncStorage.removeItem('user_data');
          }
        }

        const savedTheme = await AsyncStorage.getItem('app_theme');
        if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'automatic') {
          store.dispatch(setTheme(savedTheme));
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
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
      SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  return (
    <MenuProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Provider store={store}>
          <BottomSheetModalProvider>
            {!appIsReady || !splashAnimationFinished ? (
              <View style={{ flex: 1 }}>
                <AnimatedSplashScreen
                  onAnimationFinish={() => setSplashAnimationFinished(true)}
                />
              </View>
            ) : (
              <RootAppContent />
            )}
          </BottomSheetModalProvider>
        </Provider>
      </GestureHandlerRootView>
    </MenuProvider>
  );
}

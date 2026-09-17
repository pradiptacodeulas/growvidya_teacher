import { useColorScheme } from 'react-native';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { setTheme, UIState } from '@/redux/features/ui/slice';
import { Palette } from './Colors';

export type ThemeMode = UIState['theme'];

export interface ColorPalette {
  background: string;
  surface: string;
  surfaceSubtle: string;
  headerBg: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryLight: string;
  cardBg: string;
  tabBarBg: string;
  tabBarBorder: string;
  inputBg: string;
  inputBorder: string;
  icon: string;
  badgeBg: string;
  shadowColor: string;
  statusBarStyle: 'light' | 'dark';
}

export const lightColors: ColorPalette = {
  background: Palette.light.background,
  surface: Palette.light.surface,
  surfaceSubtle: Palette.light.surfaceSubtle,
  headerBg: Palette.light.headerBg,
  text: Palette.light.textPrimary,
  textSecondary: Palette.light.textSecondary,
  textMuted: Palette.light.textMuted,
  border: Palette.light.border,
  primary: Palette.light.primary,
  primaryLight: Palette.light.primaryLight,
  cardBg: Palette.light.cardBg,
  tabBarBg: Palette.light.tabBarBg,
  tabBarBorder: Palette.light.tabBarBorder,
  inputBg: Palette.light.inputBg,
  inputBorder: Palette.light.inputBorder,
  icon: Palette.light.icon,
  badgeBg: Palette.light.badgeBg,
  shadowColor: Palette.light.shadowColor,
  statusBarStyle: Palette.light.statusBarStyle,
};

export const darkColors: ColorPalette = {
  background: Palette.dark.background,
  surface: Palette.dark.surface,
  surfaceSubtle: Palette.dark.surfaceSubtle,
  headerBg: Palette.dark.headerBg,
  text: Palette.dark.textPrimary,
  textSecondary: Palette.dark.textSecondary,
  textMuted: Palette.dark.textMuted,
  border: Palette.dark.border,
  primary: Palette.dark.primary,
  primaryLight: Palette.dark.primaryLight,
  cardBg: Palette.dark.cardBg,
  tabBarBg: Palette.dark.tabBarBg,
  tabBarBorder: Palette.dark.tabBarBorder,
  inputBg: Palette.dark.inputBg,
  inputBorder: Palette.dark.inputBorder,
  icon: Palette.dark.icon,
  badgeBg: Palette.dark.badgeBg,
  shadowColor: Palette.dark.shadowColor,
  statusBarStyle: Palette.dark.statusBarStyle,
};

export function useAppTheme() {
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector((state) => state.ui.theme);
  const systemColorScheme = useColorScheme();

  const isDark =
    themeMode === 'dark' ||
    (themeMode === 'automatic' && systemColorScheme === 'dark');

  const colors = isDark ? darkColors : lightColors;

  const changeTheme = (mode: ThemeMode) => {
    dispatch(setTheme(mode));
  };

  return {
    themeMode,
    isDark,
    colors,
    setTheme: changeTheme,
  };
}

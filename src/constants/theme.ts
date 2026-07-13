/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#f9fafb', // Clean card/element background
    backgroundSelected: '#f3f0ff', // Subtle purple background for selected items
    textSecondary: '#5e636e',
    primary: '#7c3aed', // Purple accent
    secondary: '#f59e0b', // Yellow accent
    accent: '#000000', // Black
  },
  dark: {
    text: '#ffffff',
    background: '#0b0c0e', // Sleek dark base
    backgroundElement: '#181a1f', // Dark gray card background
    backgroundSelected: '#292150', // Subtle dark purple selection
    textSecondary: '#9fa4b0',
    primary: '#a78bfa', // Light purple
    secondary: '#fbbf24', // Light yellow
    accent: '#ffffff', // White
  },
} as const;

export const BorderRadius = {
  small: 8,
  medium: 16,
  large: 24,
  full: 9999,
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

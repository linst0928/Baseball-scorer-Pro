import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { AppState, Platform } from "react-native";
import * as NavigationBar from "expo-navigation-bar";
import * as ScreenOrientation from "expo-screen-orientation";
import "@/lib/_core/nativewind-pressable";
import { FieldingNotationPreferencesProvider } from "@/lib/fielding-notation-preferences";
import { ThemeProvider } from "@/lib/theme-provider";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { trpc, createTRPCClient } from "@/lib/trpc";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  // Initialize Manus runtime for cookie injection from parent container
  useEffect(() => {
    initManusRuntime();
  }, []);

  // The scoring workspace is designed exclusively for landscape operation.
  // Keep the runtime lock in addition to app.config.ts so Android remains
  // landscape after returning from a system screen or an interrupted launch.
  useEffect(() => {
    if (Platform.OS === "web") return;

    const lockLandscape = async () => {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } catch {
        // Native orientation support is unavailable only in unsupported shells.
      }
    };

    void lockLandscape();
    const retryTimer = setTimeout(() => void lockLandscape(), 400);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void lockLandscape();
    });
    const orientationSubscription = ScreenOrientation.addOrientationChangeListener(({ orientationInfo }) => {
      const orientation = orientationInfo.orientation;
      const isLandscape =
        orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
      if (!isLandscape) void lockLandscape();
    });

    return () => {
      clearTimeout(retryTimer);
      subscription.remove();
      orientationSubscription.remove();
    };
  }, []);

  // Android scoring screens use immersive mode to preserve the full landscape
  // workspace. A bottom swipe can still reveal system navigation temporarily.
  useEffect(() => {
    if (Platform.OS !== "android") return;

    const hideSystemNavigation = () => {
      void NavigationBar.setVisibilityAsync("hidden").catch(() => undefined);
    };

    hideSystemNavigation();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") hideSystemNavigation();
    });

    return () => subscription.remove();
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  // Create clients once and reuse them
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Disable automatic refetching on window focus for mobile
            refetchOnWindowFocus: false,
            // Retry failed requests once
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  // Ensure minimum 8px padding for top and bottom on mobile
  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <FieldingNotationPreferencesProvider>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            {/* Default to hiding native headers so raw route segments don't appear (e.g. "(tabs)", "products/[id]"). */}
            {/* If a screen needs the native header, explicitly enable it and set a human title via Stack.Screen options. */}
            {/* in order for ios apps tab switching to work properly, use presentation: "fullScreenModal" for login page, whenever you decide to use presentation: "modal*/}
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="symbols" />
              <Stack.Screen name="reading-preferences" />
              <Stack.Screen name="oauth/callback" />
            </Stack>
            <StatusBar hidden={Platform.OS === "android"} />
          </QueryClientProvider>
        </trpc.Provider>
      </FieldingNotationPreferencesProvider>
    </GestureHandlerRootView>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {content}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
    </ThemeProvider>
  );
}

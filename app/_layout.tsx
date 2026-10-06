import React from "react";
import { useEffect } from "react";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as NavigationBar from "expo-navigation-bar";
import { SesionProvider } from "../lib/sesion";

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    NavigationBar.setVisibilityAsync("hidden").catch(() => {});
  }, []);

  return (
    <SesionProvider>
      <StatusBar style="dark" hidden />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="registro" />
        <Stack.Screen name="bienvenida-cliente" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="cliente" />
      </Stack>
    </SesionProvider>
  );
}
import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { Redirect } from "expo-router";
import { useSesion } from "../../lib/sesion";
import { COLORS } from "../../lib/ui";

export default function AppLayout() {
  const { sesion, cargando } = useSesion();

  if (cargando) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.bg }}>
        <ActivityIndicator color={COLORS.azul} size="large" />
      </View>
    );
  }
  if (!sesion || sesion.rol !== "admin") return <Redirect href="/login" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="notificaciones" options={{ presentation: "modal" }} />
      <Stack.Screen name="reportes" />
      <Stack.Screen name="calendario" />
      <Stack.Screen name="tasa-dia" />
      <Stack.Screen name="interes" />
    </Stack>
  );
}
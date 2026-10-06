import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack, Redirect } from "expo-router";
import { useSesion } from "../../lib/sesion";
import { COLORS } from "../../lib/ui";

export default function ClienteLayout() {
  const { sesion, cargando } = useSesion();

  if (cargando) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.bg }}>
        <ActivityIndicator color={COLORS.azul} size="large" />
      </View>
    );
  }
  if (!sesion || sesion.rol !== "cliente") return <Redirect href="/login" />;
  // Perfil incompleto: debe terminar el asistente de 5 pasos.
  if (!sesion.perfilCompleto) return <Redirect href="/bienvenida-cliente" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="pagos" />
      <Stack.Screen name="historial" />
      <Stack.Screen name="perfil" />
      <Stack.Screen name="reportes" />
      <Stack.Screen name="calculadora" />
      <Stack.Screen name="tasa-dia" />
      <Stack.Screen name="calendario" />
      <Stack.Screen name="pagar" options={{ presentation: "modal" }} />
      <Stack.Screen name="solicitar" options={{ presentation: "modal" }} />
    </Stack>
  );
}

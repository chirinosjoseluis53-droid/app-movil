import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { COLORS } from "./ui";

type Tab = {
  clave: string;
  texto: string;
  icono: string;
  iconoOff: string;
  ruta: string;
};

export const TABS_CLIENTE: Tab[] = [
  { clave: "inicio", texto: "Inicio", icono: "home", iconoOff: "home-outline", ruta: "/cliente" },
  { clave: "pagos", texto: "Mis pagos", icono: "card", iconoOff: "card-outline", ruta: "/cliente/pagos" },
  { clave: "historial", texto: "Historial", icono: "time", iconoOff: "time-outline", ruta: "/cliente/historial" },
  { clave: "perfil", texto: "Perfil", icono: "person", iconoOff: "person-outline", ruta: "/cliente/perfil" },
];

// Barra de navegación flotante de abajo del cliente.
// Se posiciona encima del borde seguro del sistema automáticamente.
export function BarraInferior({ visible = true }: { visible?: boolean }) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  // Posicionamos encima del borde seguro del sistema (barra de gestos/botones del teléfono)
  const bottomOffset = Math.max(insets.bottom + 20, 40);

  return (
    <View style={[styles.wrapper, { paddingBottom: bottomOffset }]}>
      <View style={styles.barra}>
        {TABS_CLIENTE.map((t) => {
          const activo = pathname === t.ruta;
          return (
            <TouchableOpacity
              key={t.clave}
              style={styles.item}
              onPress={() => !activo && router.push(t.ruta as any)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activo }}
              accessibilityLabel={t.texto}
            >
              <View style={[styles.icono, activo && styles.iconoActivo]}>
                <Ionicons
                  name={(activo ? t.icono : t.iconoOff) as any}
                  size={24}
                  color={activo ? "#10B981" : COLORS.textoSuave}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    elevation: 20,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  barra: {
    flexDirection: "row",
    paddingTop: 12,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    gap: 4,
  },
  icono: {
    width: 48,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  iconoActivo: {
    backgroundColor: "#ECFDF5",
  },
  texto: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textoSuave,
  },
  textoActivo: {
    color: "#10B981",
    fontWeight: "700",
  },
});

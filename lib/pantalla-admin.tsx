import React, { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as ui from "./ui";
import { COLORS, Foto, FranjaAzul, MenuLateral, OpcionMenu } from "./ui";
import { useSesion } from "./sesion";

// Envuelve las ventanas del administrador con la franja azul superior
// (hamburguesa + título) y el panel de navegación lateral.
export function PantallaAdmin({
  titulo,
  subtitulo,
  activo,
  opciones = ui.MENU_ADMIN,
  children,
  onRefresh,
  recargando,
}: {
  titulo: string;
  subtitulo?: string;
  activo: string;
  opciones?: OpcionMenu[];
  children: React.ReactNode;
  onRefresh?: () => void;
  recargando?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const router = useRouter();
  const { sesion } = useSesion();
  const nombre = sesion?.rol === "admin" ? sesion.username : "Administrador";

  return (
    <View style={styles.raiz}>
      <FranjaAzul
        titulo={titulo}
        subtitulo={subtitulo}
        onMenu={() => setAbierto(true)}
        onBack={router.canGoBack() ? () => router.back() : undefined}
        derecha={<Foto size={40} borde />}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.contenido}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={!!recargando} onRefresh={onRefresh} /> : undefined
        }
      >
        {children}
      </ScrollView>
      <MenuLateral
        visible={abierto}
        onClose={() => setAbierto(false)}
        activo={activo}
        opciones={opciones}
        onNavegar={(ruta) => router.push(ruta as any)}
      >
        <View style={ui.styles.menuPerfil}>
          <Foto size={64} />
          <Text style={ui.styles.menuNombre} numberOfLines={1}>
            {nombre}
          </Text>
          <Text style={ui.styles.menuCorreo} numberOfLines={1}>
            Administrador
          </Text>
        </View>
      </MenuLateral>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: COLORS.bg },
  contenido: { padding: 16, paddingTop: 18, paddingBottom: 130 },
});

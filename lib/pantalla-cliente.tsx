import React, { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { api, useQuery } from "./api";
import { BarraInferior } from "./barra-inferior";
import { useSesion } from "./sesion";
import * as ui from "./ui";
import { COLORS, Foto, FranjaAzul, MenuLateral, OpcionMenu } from "./ui";

// Envuelve cualquier pantalla del cliente con la franja azul superior
// (hamburguesa + título + foto) y el panel de navegación lateral.
export function PantallaCliente({
  titulo,
  subtitulo,
  activo,
  opciones = ui.MENU_CLIENTE,
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
  const clienteId = sesion?.rol === "cliente" ? sesion.clienteId : undefined;

  const perfil: any = useQuery(api.portalCliente.me, clienteId ? { clienteId } : "skip");
  const resumen: any = useQuery(api.portalCliente.resumen, clienteId ? { clienteId } : "skip");

  const pendientes = resumen?.pendingPayments ? String(resumen.pendingPayments) : undefined;
  const conBadge = opciones.map((o) =>
    o.clave === "pagos" && pendientes ? { ...o, badge: pendientes } : o
  );
  const nombre = [perfil?.nombre, perfil?.apellido].filter(Boolean).join(" ") || "Cliente";

  return (
    <View style={styles.raiz}>
      <FranjaAzul
        titulo={titulo}
        subtitulo={subtitulo}
        onMenu={() => setAbierto(true)}
        onBack={router.canGoBack() ? () => router.back() : undefined}
        derecha={<Foto uri={perfil?.fotoPerfil} size={40} borde />}
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
      <BarraInferior visible={!abierto} />
      <MenuLateral
        visible={abierto}
        onClose={() => setAbierto(false)}
        activo={activo}
        opciones={conBadge}
        onNavegar={(ruta) => router.push(ruta as any)}
      >
        <View style={ui.styles.menuPerfil}>
          <Foto uri={perfil?.fotoPerfil} size={64} />
          <Text style={ui.styles.menuNombre} numberOfLines={1}>
            {nombre}
          </Text>
          <Text style={ui.styles.menuCorreo} numberOfLines={1}>
            {sesion?.rol === "cliente" ? sesion.email : ""}
          </Text>
        </View>
      </MenuLateral>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: COLORS.bg },
  contenido: { padding: 16, paddingTop: 18, paddingBottom: 160 },
});

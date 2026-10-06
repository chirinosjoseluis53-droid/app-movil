import React from "react";
import { Linking, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { api, useQuery } from "../../lib/api";
import { PantallaCliente } from "../../lib/pantalla-cliente";
import { useSesion } from "../../lib/sesion";
import { Badge, Button, Card, COLORS, Foto, Row, SectionTitle } from "../../lib/ui";

export default function PerfilCliente() {
  const { sesion, cerrar } = useSesion();
  const clienteId = sesion?.rol === "cliente" ? sesion.clienteId : undefined;
  const perfil: any = useQuery(api.portalCliente.me, clienteId ? { clienteId } : "skip");
  const resumen: any = useQuery(api.portalCliente.resumen, clienteId ? { clienteId } : "skip");

  const abrirMapa = () => {
    if (perfil?.lat == null || perfil?.lng == null) return;
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${perfil.lat},${perfil.lng}`
    );
  };

  return (
    <PantallaCliente
      titulo="Mi perfil"
      subtitulo={perfil?.codigoRef ? `Ref. ${perfil.codigoRef}` : undefined}
      activo="perfil"
    >
      <View style={{ alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Foto uri={perfil?.fotoPerfil} size={96} />
        <Text style={{ color: COLORS.azul, fontSize: 20, fontWeight: "800" }}>
          {[perfil?.nombre, perfil?.apellido].filter(Boolean).join(" ")}
        </Text>
        <Text style={{ color: COLORS.textoSuave, fontSize: 13 }}>C.I. {perfil?.cedula || "-"}</Text>
        {perfil?.bloqueado ? <Badge estado="bloqueado" /> : <Badge estado="aprobado" />}
      </View>

      <SectionTitle>Datos personales</SectionTitle>
      <Card>
        <Row label="Nombre" value={perfil?.nombre || "-"} />
        <Row label="Apellido" value={perfil?.apellido || "-"} />
        <Row label="Cédula" value={perfil?.cedula || "-"} />
        <Row label="Teléfono" value={perfil?.telefono || "-"} />
        <Row label="Correo" value={sesion?.rol === "cliente" ? sesion.email : "-"} />
        <Row label="Código de ref." value={perfil?.codigoRef || "-"} />
      </Card>

      <SectionTitle>Ubicación</SectionTitle>
      <Card>
        <Row label="Dirección" value={perfil?.ubicacion || "-"} />
        {perfil?.lat != null ? (
          <Row
            label="Coordenadas"
            value={`${Number(perfil.lat).toFixed(5)}, ${Number(perfil.lng).toFixed(5)}`}
          />
        ) : null}
        {perfil?.lat != null ? (
          <Button
            title="Ver en Google Maps"
            variant="outline"
            onPress={abrirMapa}
            style={{ marginTop: 10 }}
          />
        ) : null}
      </Card>

      <SectionTitle>Documentos</SectionTitle>
      <Card>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Doc uri={perfil?.fotoFront} etiqueta="Cédula (frente)" />
          <Doc uri={perfil?.fotoBack} etiqueta="Cédula (reverso)" />
        </View>
      </Card>

      <SectionTitle>Resumen de cuenta</SectionTitle>
      <Card>
        <Row label="Préstamos" value={String(resumen?.loans ?? 0)} />
        <Row label="Total prestado" value={resumen?.borrowed ?? 0} />
        <Row label="Total pagado" value={resumen?.paid ?? 0} />
        <Row label="Saldo pendiente" value={resumen?.balance ?? 0} />
      </Card>

      <Button title="Cerrar sesión" variant="danger" onPress={cerrar} style={{ marginTop: 20 }} />
    </PantallaCliente>
  );
}

function Doc({ uri, etiqueta }: { uri?: string | null; etiqueta: string }) {
  return (
    <View style={{ flex: 1, gap: 6, alignItems: "center" }}>
      {uri ? (
        <Foto uri={uri} size={110} />
      ) : (
        <View
          style={{
            width: 110,
            height: 110,
            borderRadius: 12,
            backgroundColor: COLORS.grisClaro,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="image-outline" size={22} color={COLORS.gris} />
        </View>
      )}
      <Text style={{ color: COLORS.textoSuave, fontSize: 11, textAlign: "center" }}>{etiqueta}</Text>
    </View>
  );
}

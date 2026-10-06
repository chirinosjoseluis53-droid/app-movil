import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from "react-native";
import { useMutation, useQuery } from "../../../lib/api";
import { api } from "../../../lib/api";
import { Card, Row, SectionTitle, Button, Badge, Empty, COLORS, fmt } from "../../../lib/ui";
import { PantallaAdmin } from "../../../lib/pantalla-admin";
import { mensajeWhatsApp, linkWhatsApp } from "../../../lib/helpers";

function diasHasta(fecha?: string): number | null {
  if (!fecha) return null;
  const hoy = new Date();
  const fin = new Date(fecha + "T00:00:00");
  hoy.setHours(0, 0, 0, 0);
  return Math.round((fin.getTime() - hoy.getTime()) / 86400000);
}

export default function Recordatorios() {
  const data = useQuery(api.recordatorios.vencimientos, { dias: 30 });
  const cfg = useQuery(api.settings.getConfig);
  const enviar = useMutation(api.recordatorios.enviar);

  async function abrirWhatsApp(p: any) {
    const texto = mensajeWhatsApp(cfg?.mensaje_recordatorio, {
      nombre: p.nombre,
      monto: `${p.moneda} ${fmt(p.saldo)}`,
      vencimiento: p.fechaVencimiento,
      negocio: cfg?.negocio_nombre,
    });
    if (!p.telefono) {
      Alert.alert("Sin teléfono", `${p.nombre} no tiene teléfono registrado.`);
      return;
    }
    try {
      await Linking.openURL(linkWhatsApp(p.telefono, texto, cfg?.pais_wa));
    } catch {
      Alert.alert("No se pudo abrir WhatsApp", "Revisa que la app esté instalada en el teléfono.");
      return;
    }
    // Solo se registra como enviado si el mensaje se abrió.
    await enviar({ prestamoId: p._id, canal: "whatsapp", notas: texto.slice(0, 120) });
  }

  return (
    <PantallaAdmin titulo="Vencimientos próximos" activo="">

      {!data?.proximos?.length && <Empty mensaje="No hay vencimientos en los próximos 30 días" />}
      {data?.proximos.map((p: any) => {
        const restan = diasHasta(p.fechaVencimiento);
        const atrasado = restan !== null && restan < 0;
        return (
          <Card key={p._id} style={styles.card}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={styles.nombre}>{p.nombre}</Text>
              <Badge estado={atrasado ? "atrasado" : "activo"} />
            </View>
            <Row label="Saldo" value={`${p.moneda} ${fmt(p.saldo)}`} />
            <Row label="Vence" value={p.fechaVencimiento} />
            <Row
              label="Plazo"
              value={
                restan === null
                  ? "—"
                  : atrasado
                  ? `Atrasado ${Math.abs(restan)} días`
                  : restan === 0
                  ? "Vence hoy"
                  : `En ${restan} días`
              }
            />
            <TouchableOpacity style={styles.whats} onPress={() => abrirWhatsApp(p)}>
              <Text style={styles.whatsText}>Enviar WhatsApp 📲</Text>
            </TouchableOpacity>
            {!p.telefono ? <Text style={styles.sinTel}>Sin teléfono registrado</Text> : null}
          </Card>
        );
      })}

      <SectionTitle>Últimos recordatorios</SectionTitle>
      {!data?.ultimos?.length && <Empty mensaje="Nada registrado aún" />}
      {data?.ultimos.map((r: any) => (
        <Card key={r._id} style={styles.card}>
          <Text style={styles.nombre}>{r.nombre}</Text>
          <Row label="Fecha" value={r.fecha} />
          <Row label="Canal" value={r.canal || "whatsapp"} />
          {r.notas ? <Row label="Mensaje" value={r.notas} /> : null}
        </Card>
      ))}

      <Text style={styles.nota}>
        El mensaje se arma con la plantilla de Ajustes y se abre WhatsApp con el chat listo. El registro
        se guarda solo si el mensaje se abrió.
      </Text>
    </PantallaAdmin>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 8 },
  nombre: { fontSize: 16, fontWeight: "800", color: COLORS.texto },
  whats: {
    marginTop: 8,
    backgroundColor: "#25D366",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  whatsText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  sinTel: { color: COLORS.rojo, fontSize: 12, marginTop: 6, textAlign: "center" },
  nota: { color: COLORS.textoSuave, fontSize: 12, lineHeight: 16, marginTop: 10 },
});
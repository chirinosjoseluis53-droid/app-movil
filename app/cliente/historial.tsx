import React, { useMemo } from "react";
import { Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { api, useQuery } from "../../lib/api";
import { PantallaCliente } from "../../lib/pantalla-cliente";
import { useSesion } from "../../lib/sesion";
import { Card, COLORS, fmtDinero, SectionTitle } from "../../lib/ui";

type Evento = {
  clave: string;
  fecha: string;
  titulo: string;
  detalle: string;
  monto: number;
  icono: any;
  color: string;
};

export default function Historial() {
  const { sesion } = useSesion();
  const clienteId = sesion?.rol === "cliente" ? sesion.clienteId : undefined;

  const prestamos: any[] = useQuery(
    api.portalCliente.misPrestamos,
    clienteId ? { clienteId } : "skip"
  ) || [];
  const pagos: any[] = useQuery(
    api.portalCliente.historialPagos,
    clienteId ? { clienteId } : "skip"
  ) || [];
  const solicitudes: any[] = useQuery(
    api.portalCliente.misSolicitudesPrestamo,
    clienteId ? { clienteId } : "skip"
  ) || [];

  const eventos = useMemo<Evento[]>(() => {
    const lista: Evento[] = [];

    for (const p of prestamos) {
      lista.push({
        clave: "pre" + p.id,
        fecha: p.fechaPrestamo,
        titulo: "Préstamo otorgado",
        detalle: `Saldo actual ${fmtDinero(p.saldo, p.moneda)}`,
        monto: Number(p.monto) || 0,
        icono: "cash-outline",
        color: COLORS.azul,
      });
    }
    for (const g of pagos) {
      lista.push({
        clave: "pag" + g.id,
        fecha: g.fecha,
        titulo: "Pago registrado",
        detalle: g.concepto || g.metodo || "Abono",
        monto: Number(g.monto) || 0,
        icono: "arrow-down-circle-outline",
        color: COLORS.verde,
      });
    }
    for (const s of solicitudes) {
      lista.push({
        clave: "sol" + s._id,
        fecha: s.fechaCreacion,
        titulo: "Solicitud de préstamo",
        detalle: `${s.metodo_label || s.metodoPago} · ${s.estado}`,
        monto: Number(s.monto) || 0,
        icono: "document-text-outline",
        color: s.estado === "aprobado" ? COLORS.verde : s.estado === "rechazado" ? COLORS.rojo : COLORS.naranja,
      });
    }

    return lista.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  }, [prestamos, pagos, solicitudes]);

  return (
    <PantallaCliente titulo="Historial" subtitulo={`${eventos.length} movimientos`} activo="historial">
      <SectionTitle>Movimientos</SectionTitle>
      {eventos.length === 0 ? (
        <Card>
          <View style={{ alignItems: "center", gap: 8 }}>
            <Ionicons name="time-outline" size={28} color={COLORS.gris} />
            <Text style={{ color: COLORS.textoSuave, textAlign: "center" }}>
              Todavía no tienes movimientos registrados.
            </Text>
          </View>
        </Card>
      ) : (
        eventos.map((e) => (
          <Card key={e.clave}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: COLORS.grisClaro,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name={e.icono} size={18} color={e.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: COLORS.texto, fontWeight: "700", fontSize: 14 }}>{e.titulo}</Text>
                <Text style={{ color: COLORS.textoSuave, fontSize: 12 }}>
                  {fecha(e.fecha)} · {e.detalle}
                </Text>
              </View>
              <Text style={{ color: e.color, fontWeight: "800", fontSize: 14 }}>
                {e.monto ? fmtDinero(e.monto) : "-"}
              </Text>
            </View>
          </Card>
        ))
      )}
    </PantallaCliente>
  );
}

function fecha(iso: string) {
  const f = String(iso || "").slice(0, 10);
  const [a, m, d] = f.split("-");
  return d && m && a ? `${d}/${m}/${a}` : f || "-";
}

import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { api, useQuery } from "../../lib/api";
import { PantallaCliente } from "../../lib/pantalla-cliente";
import { useSesion } from "../../lib/sesion";
import {
  exportarPagosPDF,
  exportarPagosXLSX,
  hoyISO,
  resumenDesdePagos,
} from "../../lib/reportes";
import { Button, Card, COLORS, fmtDinero, Input, SectionTitle, StatCard } from "../../lib/ui";

const mesISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const inicioMes = () => `${mesISO(new Date())}-01`;

export default function Reportes() {
  const { sesion } = useSesion();
  const clienteId = sesion?.rol === "cliente" ? sesion.clienteId : undefined;

  const [desde, setDesde] = useState(inicioMes());
  const [hasta, setHasta] = useState(hoyISO());
  const [ocupado, setOcupado] = useState<"" | "excel" | "pdf">("");
  const [aviso, setAviso] = useState("");

  const perfil: any = useQuery(api.portalCliente.me, clienteId ? { clienteId } : "skip");
  const pagos: any[] = useQuery(
    api.portalCliente.historialPagos,
    clienteId ? { clienteId } : "skip"
  ) || [];

  const rango = useMemo(() => {
    const a = desde.trim();
    const b = hasta.trim();
    if (a && b && a > b) return { error: "La fecha inicial es posterior a la final" };
    if (!a && !b) return { error: "Indica al menos una fecha" };
    return {};
  }, [desde, hasta]);

  const resumen = useMemo(
    () =>
      resumenDesdePagos(
        [perfil?.nombre, perfil?.apellido].filter(Boolean).join(" ") || "Cliente",
        perfil?.cedula || "",
        desde.trim(),
        hasta.trim(),
        pagos.map((p) => ({
          fecha: p.fecha,
          referencia: p.referencia || "",
          metodo: p.metodo || "",
          monto: Number(p.monto) || 0,
          saldo: Number(p.saldo) || 0,
          estado: p.estado || "",
          concepto: p.concepto || "",
        }))
      ),
    [pagos, desde, hasta, perfil]
  );

  const exportar = async (tipo: "excel" | "pdf") => {
    if (rango.error) {
      setAviso(rango.error);
      return;
    }
    setAviso("");
    setOcupado(tipo);
    try {
      const ok =
        tipo === "excel" ? await exportarPagosXLSX(resumen) : await exportarPagosPDF(resumen);
      if (!ok) setAviso("No se pudo abrir el menú de compartir en este dispositivo.");
    } catch (e: any) {
      setAviso(e?.message || "Error al generar el reporte");
    } finally {
      setOcupado("");
    }
  };

  const rangoTexto = `${(desde || "…").slice(8, 10)}/${(desde || "…").slice(5, 7)}/${(desde || "…").slice(0, 4)} – ${(hasta || "…").slice(8, 10)}/${(hasta || "…").slice(5, 7)}/${(hasta || "…").slice(0, 4)}`;

  return (
    <PantallaCliente
      titulo="Reportes"
      subtitulo={`${resumen.cantidad} pagos · ${rangoTexto}`}
      activo="reportes"
    >
      <Card>
        <Text style={{ color: COLORS.azul, fontWeight: "800", marginBottom: 12 }}>
          Resumen de pagos por fecha
        </Text>
        <Input label="Desde (AAAA-MM-DD)" value={desde} onChangeText={setDesde} placeholder="2026-01-01" autoCapitalize="none" />
        <Input label="Hasta (AAAA-MM-DD)" value={hasta} onChangeText={setHasta} placeholder="2026-12-31" autoCapitalize="none" />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button title="Este mes" variant="outline" onPress={() => { setDesde(inicioMes()); setHasta(hoyISO()); }} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Todo" variant="outline" onPress={() => { setDesde(""); setHasta(""); }} />
          </View>
        </View>
      </Card>

      {rango.error ? (
        <Card style={{ backgroundColor: COLORS.rojoClaro, borderColor: COLORS.rojo }}>
          <Text style={{ color: COLORS.rojo }}>{rango.error}</Text>
        </Card>
      ) : null}

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <StatCard label="Total" valor={fmtDinero(resumen.total)} sub={rangoTexto} color={COLORS.azul} />
        </View>
        <View style={{ flex: 1 }}>
          <StatCard label="Pagos" valor={String(resumen.cantidad)} sub={`máx ${fmtDinero(resumen.mayor)}`} color={COLORS.teal} />
        </View>
      </View>

      <SectionTitle>Descargar</SectionTitle>
      <Card>
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
          <Ionicons name="stats-chart" size={20} color={COLORS.verde} />
          <Text style={{ color: COLORS.textoSuave, fontSize: 12, flex: 1 }}>
            El Excel incluye dos hojas: el detalle de pagos y el resumen del período.
          </Text>
        </View>
        <Button
          title="Descargar en Excel"
          variant="secondary"
          loading={ocupado === "excel"}
          onPress={() => exportar("excel")}
        />
        <Button
          title="Descargar en PDF"
          variant="outline"
          loading={ocupado === "pdf"}
          onPress={() => exportar("pdf")}
        />
        {aviso ? <Text style={{ color: COLORS.rojo, fontSize: 12, marginTop: 4 }}>{aviso}</Text> : null}
      </Card>

      <SectionTitle>Vista previa ({resumen.cantidad})</SectionTitle>
      {resumen.pagos.length === 0 ? (
        <Card>
          <Text style={{ color: COLORS.textoSuave, textAlign: "center" }}>
            No hay pagos en el rango seleccionado.
          </Text>
        </Card>
      ) : (
        resumen.pagos.map((p: any, i: number) => (
          <Card key={i}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View>
                <Text style={{ color: COLORS.texto, fontWeight: "700" }}>{fmtDinero(p.monto)}</Text>
                <Text style={{ color: COLORS.textoSuave, fontSize: 12 }}>
                  {p.fecha} · {p.metodo}
                </Text>
              </View>
              <Text style={{ color: COLORS.textoSuave, fontSize: 12, alignSelf: "center" }}>
                saldo {fmtDinero(p.saldo)}
              </Text>
            </View>
          </Card>
        ))
      )}
    </PantallaCliente>
  );
}

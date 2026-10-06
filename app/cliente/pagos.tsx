import React, { useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { api, useQuery } from "../../lib/api";
import { compartirArchivo } from "../../lib/compartir";
import { crearPdf, imprimirHtml } from "../../lib/pdf";
import { reciboHtml } from "../../lib/recibo";
import { PantallaCliente } from "../../lib/pantalla-cliente";
import { useSesion } from "../../lib/sesion";
import { Badge, Card, COLORS, Chip, fmtDinero, SectionTitle, StatCard, Button } from "../../lib/ui";

type Filtro = "todos" | "registrados" | "enviados";

export default function MisPagos() {
  const { sesion } = useSesion();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  // clave del pago cuya factura se está generando/compartiendo (evita doble toque)
  const [descargando, setDescargando] = useState<string | null>(null);
  const clienteId = sesion?.rol === "cliente" ? sesion.clienteId : undefined;
  const clienteNombre = sesion?.rol === "cliente" ? sesion.nombre : "";

  // abonos ya aplicados al préstamo (libro real)
  const registrados: any[] = useQuery(
    api.portalCliente.historialPagos,
    clienteId ? { clienteId } : "skip"
  ) || [];
  // abonos enviados por el cliente y aún no revisados por el administrador
  const enviados: any[] = useQuery(
    api.portalCliente.misPagosEnviados,
    clienteId ? { clienteId } : "skip"
  ) || [];

  const config: any =
    useQuery(api.settings.getConfigCliente, clienteId ? { clienteId } : "skip") || null;
  const negocio = config?.negocio_nombre || "Mi Negocio de Prestamos";

  const lista = useMemo(() => {
    const base = [
      ...registrados.map((p) => ({ ...p, tipo: "registrado" as const })),
      ...enviados
        .filter((e) => e.estado !== "aprobado")
        .map((e) => ({
          id: e._id,
          fecha: e.fechaPago,
          monto: Number(e.monto) || 0,
          metodo: e.metodo_label,
          referencia: e.referencia || "",
          estado: e.estado,
          moneda: e.moneda,
          notas: "",
          prestamoId: e.prestamoId,
          saldo: 0,
          concepto: "Abono enviado",
          tipo: "enviado" as const,
        })),
    ];
    const filtrada = filtro === "todos" ? base : base.filter((x) => x.tipo === filtro);
    return filtrada.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  }, [registrados, enviados, filtro]);

  const totalRegistrado = registrados.reduce((a, p) => a + (Number(p.monto) || 0), 0);
  const totalEnviado = enviados
    .filter((e) => e.estado === "pendiente")
    .reduce((a, e) => a + (Number(e.monto) || 0), 0);

  return (
    <PantallaCliente
      titulo="Mis pagos"
      subtitulo={`${registrados.length} abonos · ${enviados.filter((e) => e.estado === "pendiente").length} en revisión`}
      activo="pagos"
    >
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <StatCard
            label="Total pagado"
            valor={fmtDinero(totalRegistrado, resumenMoneda(registrados))}
            sub={`${registrados.length} abonos`}
            color={COLORS.verde}
          />
        </View>
        <View style={{ flex: 1 }}>
          <StatCard
            label="En revisión"
            valor={fmtDinero(totalEnviado, resumenMoneda(enviados))}
            sub="Pendientes del admin"
            color={COLORS.naranja}
          />
        </View>
      </View>

      <View style={{ flexDirection: "row", marginBottom: 14 }}>
        <Chip activo={filtro === "todos"} label="Todos" onPress={() => setFiltro("todos")} />
        <Chip
          activo={filtro === "registrados"}
          label="Registrados"
          onPress={() => setFiltro("registrados")}
        />
        <Chip activo={filtro === "enviados"} label="Enviados" onPress={() => setFiltro("enviados")} />
      </View>

      <SectionTitle>Historial de pagos</SectionTitle>
      {lista.length === 0 ? (
        <Card>
          <View style={{ alignItems: "center", gap: 8 }}>
            <Ionicons name="receipt-outline" size={28} color={COLORS.gris} />
            <Text style={{ color: COLORS.textoSuave, textAlign: "center" }}>
              Todavía no hay pagos en esta sección.
            </Text>
          </View>
        </Card>
      ) : (
        lista.map((p) => (
          <Card key={p.tipo + p.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: COLORS.texto, fontWeight: "800", fontSize: 16 }}>
                  {fmtDinero(p.monto, p.moneda)}
                </Text>
                <Text style={{ color: COLORS.textoSuave, fontSize: 12 }}>
                  {fecha(p.fecha)} · {p.metodo}
                </Text>
                {p.referencia ? (
                  <Text style={{ color: COLORS.textoSuave, fontSize: 12 }}>Ref: {p.referencia}</Text>
                ) : null}
                {p.tipo === "registrado" && p.saldo > 0 ? (
                  <Text style={{ color: COLORS.textoSuave, fontSize: 12 }}>
                    Saldo tras el abono: {fmtDinero(p.saldo, p.moneda)}
                  </Text>
                ) : null}
                {p.tipo === "enviado" && p.estado === "rechazado" ? (
                  <Text style={{ color: COLORS.rojo, fontSize: 12 }}>
                    {p.motivoRechazo ? `Motivo: ${p.motivoRechazo}` : "Rechazado por el administrador"}
                  </Text>
                ) : null}
              </View>
              <Badge estado={p.estado} />
            </View>

            {(p.tipo === "registrado" || p.estado === "aprobado") && (
              <View style={{ marginTop: 12 }}>
                <Button
                  title="Descargar Factura"
                  variant="outline"
                  small
                  loading={descargando === p.tipo + p.id}
                  disabled={!!descargando}
                  onPress={async () => {
                    // expo-sharing solo admite una comparte a la vez: sin este bloqueo
                    // un doble toque lanza "Another share request is being processed now".
                    if (descargando) return;
                    setDescargando(p.tipo + p.id);

                    const emitidoISO = new Date().toISOString();
                    const html = reciboHtml({
                      negocio,
                      cliente: clienteNombre,
                      numero: String(p.referencia || p.id || "").slice(-14).toUpperCase(),
                      emitidoISO,
                      estado: p.estado,
                      monto: fmtDinero(p.monto, p.moneda),
                      fechaPago: fecha(emitidoISO),
                      metodo: p.metodo,
                      referencia: p.referencia || "",
                      concepto: p.concepto || "",
                      prestamo: p.prestamoId ? String(p.prestamoId).slice(-10).toUpperCase() : "",
                      saldo: Number(p.saldo) || 0,
                      saldoTexto: fmtDinero(p.saldo, p.moneda),
                    });

                    try {
                      const { isAvailableAsync } = await import("expo-sharing");
                      const ref = String(p.referencia || p.id).replace(/[^a-zA-Z0-9_-]/g, "_");
                      const pdfPath = await crearPdf(html, `Recibo_Pago_${ref}`);

                      if (await isAvailableAsync()) {
                        await compartirArchivo({
                          uri: pdfPath,
                          titulo: "Factura de pago",
                          mime: "pdf",
                        });
                      } else {
                        // Sin compartir disponible: abrimos el diálogo de impresión,
                        // donde el usuario puede guardar el PDF.
                        await imprimirHtml(html);
                      }
                    } catch (e) {
                      console.log("Error generando PDF:", e);
                      // Si el archivo no salió bien, abrimos el diálogo de
                      // impresión: siempre permite guardarlo como PDF.
                      Alert.alert(
                        "Factura",
                        "No se pudo compartir el archivo. Abrimos la impresión para que lo guardes como PDF."
                      );
                      try {
                        await imprimirHtml(html);
                      } catch (e2) {
                        console.log("Error imprimiendo PDF:", e2);
                      }
                    } finally {
                      setDescargando(null);
                    }
                  }}
                />
              </View>
            )}
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

function resumenMoneda(lista: any[]) {
  return lista[0]?.moneda || "BS";
}

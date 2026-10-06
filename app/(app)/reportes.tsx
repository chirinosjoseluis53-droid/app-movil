import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "../../lib/api";
import { api } from "../../lib/api";
import { PantallaAdmin } from "../../lib/pantalla-admin";
import {
  exportarPrestamosPDF, exportarPrestamosXLSX, PrestamoReporte, totalesPorMoneda,
} from "../../lib/reportes-admin";
import { Button, Card, Chip, COLORS, Empty, Row, SectionTitle, StatCard, fmt } from "../../lib/ui";

const FILTROS = [
  { clave: "todos", label: "Todos" },
  { clave: "activo", label: "Activos" },
  { clave: "atrasado", label: "Atrasados" },
  { clave: "pagado", label: "Pagados" },
];

const RANGOS = [
  { clave: "mes", label: "Este mes" },
  { clave: "30", label: "30 días" },
  { clave: "90", label: "90 días" },
  { clave: "todo", label: "Todo" },
];

const ACCIONES: Record<string, string> = {
  pago_registrado: "Pago",
  pago_condonado: "Condonación",
  pago_eliminado: "Pago borrado",
  pago_cliente_aprobado: "Abono aprobado",
  pago_cliente_rechazado: "Abono rechazado",
  prestamo_creado: "Préstamo creado",
  prestamo_editado: "Préstamo editado",
  prestamo_eliminado: "Préstamo eliminado",
  prestamo_renovado: "Renovación",
  solicitud_aprobada: "Solicitud aprobada",
  solicitud_rechazada: "Solicitud rechazada",
  solicitud_prestamo_aprobada: "Préstamo aprobado",
  interes_creado: "Tasa creada",
  interes_editado: "Tasa editada",
  interes_eliminado: "Tasa eliminada",
  usuario_cambio: "Usuario cambiado",
  password_cambio: "Contraseña cambiada",
  config: "Ajustes",
};

const mesActual = () => new Date().toISOString().slice(0, 7);

function rangoDe(clave: string): { desde: string; hasta: string } {
  const hoy = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const hasta = iso(hoy);
  if (clave === "todo") return { desde: "0000-01-01", hasta };
  if (clave === "mes") return { desde: `${hoy.toISOString().slice(0, 7)}-01`, hasta };
  const dias = Number(clave) || 30;
  const desde = new Date(hoy.getTime() - dias * 86400000);
  return { desde: iso(desde), hasta };
}

export default function Reportes() {
  const cfg = useQuery(api.settings.getConfig);
  const lista = useQuery(api.prestamos.list, { q: undefined });
  const [filtro, setFiltro] = useState("todos");
  const [ocupado, setOcupado] = useState<"" | "excel" | "pdf">("");
  const [aviso, setAviso] = useState("");

  const [rango, setRango] = useState("mes");
  const { desde, hasta } = useMemo(() => rangoDe(rango), [rango]);
  const historial = useQuery(api.reportes.historialPagos, { desde, hasta, limite: 50 });
  const morosos = useQuery(api.reportes.morosos, { limite: 10 });
  const [mes, setMes] = useState(mesActual());
  const cierre = useQuery(api.reportes.cierreMes, { mes });
  const bitacora = useQuery(api.reportes.bitacora, { limite: 30 });

  const negocio = cfg?.negocio_nombre || "Mi Negocio de Prestamos";

  const todos: PrestamoReporte[] = useMemo(() => (lista || []) as PrestamoReporte[], [lista]);

  const filas = useMemo(
    () => (filtro === "todos" ? todos : todos.filter((p) => p.estadoCalc === filtro)),
    [todos, filtro]
  );

  const totales = useMemo(() => totalesPorMoneda(filas), [filas]);
  const etiqueta = FILTROS.find((f) => f.clave === filtro)?.label || "Todos";

  const contar = (estado: string) => todos.filter((p) => p.estadoCalc === estado).length;

  async function exportar(tipo: "excel" | "pdf") {
    setAviso("");
    if (filas.length === 0) {
      setAviso("No hay préstamos en este filtro");
      return;
    }
    setOcupado(tipo);
    try {
      const ok =
        tipo === "excel"
          ? await exportarPrestamosXLSX(filas, negocio, etiqueta)
          : await exportarPrestamosPDF(filas, negocio, etiqueta);
      if (!ok) setAviso("No se pudo abrir el menú de compartir en este dispositivo.");
    } catch (e: any) {
      setAviso(e?.message || "Error al generar el reporte");
    } finally {
      setOcupado("");
    }
  }

  return (
    <PantallaAdmin
      titulo="Reportes"
      subtitulo={`${filas.length} préstamos · ${etiqueta}`}
      activo="reportes"
    >
      <View style={styles.stats}>
        <View style={styles.cuadro}>
          <StatCard label="Préstamos" valor={String(todos.length)} sub="Totales" color={COLORS.azul} />
        </View>
        <View style={styles.cuadro}>
          <StatCard label="Activos" valor={String(contar("activo"))} sub="En curso" color={COLORS.verde} />
        </View>
        <View style={styles.cuadro}>
          <StatCard label="Atrasados" valor={String(contar("atrasado"))} sub="Con mora" color={COLORS.rojo} />
        </View>
        <View style={styles.cuadro}>
          <StatCard label="Pagados" valor={String(contar("pagado"))} sub="Cerrados" color={COLORS.textoSuave} />
        </View>
      </View>

      <View style={styles.chips}>
        {FILTROS.map((f) => (
          <Chip key={f.clave} activo={filtro === f.clave} label={f.label} onPress={() => setFiltro(f.clave)} />
        ))}
      </View>

      <SectionTitle>Totales por moneda</SectionTitle>
      {totales.length === 0 ? <Empty mensaje="Sin préstamos en este filtro." /> : null}
      {totales.map((t) => (
        <Card key={t.moneda}>
          <Row label="Préstamos" value={String(t.prestamos)} />
          <Row label="Monto prestado" value={`${t.moneda} ${fmt(t.montos)}`} />
          <Row label="Pagado" value={`${t.moneda} ${fmt(t.pagado)}`} />
          <Row label="Saldo" value={`${t.moneda} ${fmt(t.saldo)}`} />
          <Row label="Total adeudado" value={`${t.moneda} ${fmt(t.adeudado)}`} />
        </Card>
      ))}

      <SectionTitle>Descargar</SectionTitle>
      <Card>
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
          <Ionicons name="stats-chart" size={20} color={COLORS.verde} />
          <Text style={{ color: COLORS.textoSuave, fontSize: 12, flex: 1 }}>
            El Excel incluye el detalle de los préstamos y una hoja con los totales por moneda.
          </Text>
        </View>
        <Button
          title="Descargar en Excel"
          variant="secondary"
          loading={ocupado === "excel"}
          onPress={() => exportar("excel")}
        />
        <View style={{ height: 8 }} />
        <Button
          title="Descargar en PDF"
          variant="outline"
          loading={ocupado === "pdf"}
          onPress={() => exportar("pdf")}
        />
        {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}
      </Card>

      <SectionTitle>Detalle</SectionTitle>
      {filas.slice(0, 40).map((p) => (
        <Card key={p._id}>
          <View style={styles.fila}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nombre} numberOfLines={1}>
                {p.nombre}
              </Text>
              <Text style={styles.sub}>
                {p.moneda} {fmt(p.monto)} · tasa {fmt(p.tasaInteres)}%
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.saldo}>{p.moneda} {fmt(p.totalAdeudado)}</Text>
              <Text style={styles.sub}>Vence {p.fechaVencimiento}</Text>
            </View>
          </View>
        </Card>
      ))}
      {filas.length > 40 ? (
        <Text style={styles.sub}>Y {filas.length - 40} más incluidos en la descarga.</Text>
      ) : null}

      <SectionTitle>Historial de pagos</SectionTitle>
      <View style={styles.chips}>
        {RANGOS.map((r) => (
          <Chip key={r.clave} activo={rango === r.clave} label={r.label} onPress={() => setRango(r.clave)} />
        ))}
      </View>
      <Card>
        <Row label="Desde" value={desde === "0000-01-01" ? "Inicio" : desde} />
        <Row label="Hasta" value={hasta} />
        <Row label="Pagos" value={String(historial?.total ?? 0)} />
        {(historial?.porMoneda || []).map((m: any) => (
          <Row key={m.moneda} label={`Cobrado ${m.moneda}`} value={`${fmt(m.total)} (${m.n})`} />
        ))}
        {historial?.condonaciones?.n ? (
          <Row
            label="Condonaciones"
            value={`${historial.condonaciones.n} · ${fmt(historial.condonaciones.total)}`}
          />
        ) : null}
      </Card>
      {(historial?.items || []).slice(0, 20).map((p: any) => (
        <Card key={p._id}>
          <View style={styles.fila}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nombre} numberOfLines={1}>
                {p.nombre || "Préstamo eliminado"}
              </Text>
              <Text style={styles.sub}>
                {p.fecha}
                {p.notas ? ` · ${p.notas}` : ""}
              </Text>
            </View>
            <Text style={styles.saldo}>
              {p.moneda || "BS"} {fmt(p.monto)}
            </Text>
          </View>
        </Card>
      ))}
      {historial?.total > 20 ? (
        <Text style={styles.sub}>Y {historial.total - 20} pagos más en este rango.</Text>
      ) : null}

      <SectionTitle>Morosos</SectionTitle>
      <Card>
        <Row label="Préstamos atrasados" value={String(morosos?.items?.length ?? 0)} />
        <Row label="Saldo en mora" value={fmt(morosos?.saldoTotal ?? 0)} />
        <Row label="Mora acumulada" value={fmt(morosos?.moraTotal ?? 0)} />
        <Text style={styles.sub}>Ordenados de mayor a menor deuda.</Text>
      </Card>
      {(morosos?.items || []).map((p: any) => (
        <Card key={p._id}>
          <View style={styles.fila}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nombre} numberOfLines={1}>
                {p.nombre}
              </Text>
              <Text style={styles.sub}>
                {p.diasVencido} días de atraso · vence {p.fechaVencimiento}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.saldo}>
                {p.moneda} {fmt(p.totalAdeudado)}
              </Text>
              <Text style={styles.sub}>Mora {fmt(p.mora)}</Text>
            </View>
          </View>
        </Card>
      ))}

      <SectionTitle>Cierre de mes</SectionTitle>
      <View style={styles.chips}>
        {[0, 1, 2].map((atras) => {
          const d = new Date();
          d.setMonth(d.getMonth() - atras);
          const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          return (
            <Chip
              key={clave}
              activo={mes === clave}
              label={atras === 0 ? "Mes actual" : clave}
              onPress={() => setMes(clave)}
            />
          );
        })}
      </View>
      <Card>
        <Row label="Mes" value={cierre?.mes || mes} />
        {(cierre?.cobradoPorMoneda || []).map((m: any) => (
          <Row key={m.moneda} label={`Cobrado ${m.moneda}`} value={fmt(m.total)} />
        ))}
        {(cierre?.nuevosPorMoneda || []).map((m: any) => (
          <View key={`n-${m.moneda}`}>
            <Row label={`Préstamos nuevos ${m.moneda}`} value={`${m.n} · ${fmt(m.capital)}`} />
            <Row label={`Interés generado ${m.moneda}`} value={fmt(m.interesGenerado)} />
          </View>
        ))}
        <Row label="Deuda teórica del mes" value={fmt(cierre?.saldoTeorico ?? 0)} />
        <Row label="Cartera viva (hoy)" value={fmt(cierre?.carteraViva ?? 0)} />
        <Row label="Morosos al cierre" value={String(cierre?.morosos ?? 0)} />
        {cierre?.condonaciones?.n ? (
          <Row
            label="Condonaciones del mes"
            value={`${cierre.condonaciones.n} · ${fmt(cierre.condonaciones.total)}`}
          />
        ) : null}
        <Text style={styles.sub}>
          "Deuda teórica" es capital + interés de los préstamos hechos en el mes. "Cartera viva" es lo
          que falta por cobrar hoy, mora incluida.
        </Text>
      </Card>

      <SectionTitle>Bitácora</SectionTitle>
      {!bitacora?.length ? <Empty mensaje="Sin movimientos registrados" /> : null}
      {(bitacora || []).slice(0, 20).map((b: any) => (
        <Card key={b._id}>
          <View style={styles.fila}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nombre}>{ACCIONES[b.accion] || b.accion}</Text>
              <Text style={styles.sub} numberOfLines={2}>
                {b.detalle}
              </Text>
            </View>
            <Text style={styles.sub}>
              {b.fecha} {b.hora}
            </Text>
          </View>
        </Card>
      ))}
    </PantallaAdmin>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  cuadro: { flexGrow: 1, flexBasis: "45%", minWidth: 140 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  aviso: { color: COLORS.rojo, marginTop: 10, fontWeight: "600" },
  fila: { flexDirection: "row", alignItems: "center", gap: 10 },
  nombre: { fontWeight: "700", color: COLORS.texto, fontSize: 15 },
  sub: { color: COLORS.textoSuave, fontSize: 12, marginTop: 2 },
  saldo: { color: COLORS.azul, fontWeight: "800", fontSize: 14 },
});

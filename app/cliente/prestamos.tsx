import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { api, useQuery } from "../../lib/api";
import { PantallaCliente } from "../../lib/pantalla-cliente";
import { useSesion } from "../../lib/sesion";
import { Card, COLORS, Empty, Row, Badge, fmt, SectionTitle } from "../../lib/ui";

export default function MisPrestamos() {
  const { sesion } = useSesion();
  const clienteId = sesion?.rol === "cliente" ? sesion.clienteId : undefined;

  const prestamos: any[] = useQuery(
    api.portalCliente.misPrestamos,
    clienteId ? { clienteId } : "skip"
  ) || [];

  const activos = prestamos.filter((p) => p.estadoCalc !== "pagado");
  const historial = prestamos.filter((p) => p.estadoCalc === "pagado");

  return (
    <PantallaCliente titulo="Mis préstamos" activo="prestamos">
      <SectionTitle>Préstamos activos</SectionTitle>
      {activos.length === 0 ? (
        <Empty mensaje="No tienes préstamos activos en este momento." />
      ) : (
        activos.map((p) => (
          <Card key={p.id} style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.montoInicial}>
                {p.moneda} {fmt(p.monto)}
              </Text>
              <Badge estado={p.estadoCalc} />
            </View>

            <View style={styles.detallesResaltados}>
              <View style={styles.detalleItem}>
                <Text style={styles.detalleLabel}>Saldo Deuda</Text>
                <Text style={styles.detalleValorActivo}>
                  {p.moneda} {fmt(p.saldo)}
                </Text>
              </View>
              <View style={[styles.detalleItem, { alignItems: 'flex-end' }]}>
                <Text style={styles.detalleLabel}>Vencimiento</Text>
                <Text style={[styles.detalleValor, p.estadoCalc === 'atrasado' && { color: COLORS.rojo }]}>
                  {p.fechaVencimiento || "—"}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />
            <Row label="Tasa de interés" value={`${p.tasaInteres}%`} />
            <Row label="Total pagado" value={`${p.moneda} ${fmt((Number(p.monto) || 0) - (Number(p.saldo) || 0))}`} />
            <Row label="Modalidad" value={p.esCuotas ? `${p.numeroCuotas} cuotas` : "Pago único"} />
            <Row label="Fecha otorgado" value={p.fechaPrestamo} />
          </Card>
        ))
      )}

      {historial.length > 0 && (
        <>
          <SectionTitle>Historial de préstamos pagados</SectionTitle>
          {historial.map((p) => (
            <Card key={p.id} style={[styles.card, { opacity: 0.8 }]}>
              <View style={styles.header}>
                <Text style={[styles.montoInicial, { color: COLORS.textoSuave }]}>
                  {p.moneda} {fmt(p.monto)}
                </Text>
                <Badge estado="pagado" />
              </View>
              <Row label="Fecha otorgado" value={p.fechaPrestamo} />
              <Row label="Tasa de interés" value={`${p.tasaInteres}%`} />
            </Card>
          ))}
        </>
      )}
    </PantallaCliente>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  montoInicial: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  detallesResaltados: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  detalleItem: {
    flex: 1,
  },
  detalleLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detalleValorActivo: {
    fontSize: 18,
    fontWeight: '800',
    color: '#10B981',
  },
  detalleValor: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
});

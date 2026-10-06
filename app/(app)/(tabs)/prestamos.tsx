import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery } from "../../../lib/api";
import { api } from "../../../lib/api";
import {
  Card, Row, Button, Input, Select, SearchBar,
  Badge, Chip, Empty, Fab, ModalSheet, Confirmar, COLORS, fmt,
} from "../../../lib/ui";
import { PantallaAdmin } from "../../../lib/pantalla-admin";

const MONEDAS = { BS: "Bolívares (Bs.)", USD: "Dólares (USD)", EUR: "Euros (EUR)", COP: "Pesos (COP)", CLP: "Pesos (CLP)" };

export default function Prestamos() {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [limite, setLimite] = useState(20);
  const pagina = useQuery(api.prestamos.page, { q: q || undefined, limite });
  const clientes = useQuery(api.clientes.list, { q: undefined, estado: "aprobado" });

  const [modalNuevo, setModalNuevo] = useState(false);
  const [detalle, setDetalle] = useState<any>(null);
  const [modalPagar, setModalPagar] = useState<any>(null);
  const [confEliminar, setConfEliminar] = useState<any>(null);
  const [modalRenovar, setModalRenovar] = useState<any>(null);
  const [confCondonar, setConfCondonar] = useState<any>(null);

  const create = useMutation(api.prestamos.create);
  const update = useMutation(api.prestamos.update);
  const remove = useMutation(api.prestamos.remove);
  const registrarPago = useMutation(api.prestamos.registrarPago);
  const eliminarPago = useMutation(api.prestamos.eliminarPago);
  const renovar = useMutation(api.prestamos.renovar);
  const condonar = useMutation(api.prestamos.condonar);

  const [form, setForm] = useState<any>({ monto: "", tasa: "", moneda: "BS", dias: "", fechaVencimiento: "", tiempo: "", notas: "" });
  const [er, setEr] = useState("");

  // Al cambiar la búsqueda o el filtro se vuelve a la primera página.
  React.useEffect(() => {
    setLimite(20);
  }, [q, filtro]);

  const visibles = useMemo(() => {
    const rows = pagina?.items || [];
    if (filtro === "todos") return rows;
    return rows.filter((p: any) => p.estadoCalc === filtro);
  }, [pagina, filtro]);

  const clientesOpts = (clientes || []).map((c: any) => `${c.nombre} ${c.apellido} · ${c.cedula}`);
  const clienteIdDe = (nombreCompleto: string) => {
    const c = (clientes || []).find((x: any) => `${x.nombre} ${x.apellido} · ${x.cedula}` === nombreCompleto);
    return c?._id;
  };

  async function guardarNuevo() {
    setEr("");
    try {
      const clienteSel = form.cliente;
      await create({
        clienteId: clienteSel ? clienteIdDe(clienteSel) : undefined,
        nombre: clienteSel ? undefined : form.nombre,
        monto: Number(form.monto),
        tasaInteres: Number(form.tasa || 0),
        moneda: form.moneda,
        dias: form.dias ? Number(form.dias) : undefined,
        fechaVencimiento: form.fechaVencimiento || undefined,
        tiempo: form.tiempo || undefined,
        notas: form.notas || undefined,
        fechaPrestamo: form.fecha || undefined,
      });
      setModalNuevo(false);
      setForm({ monto: "", tasa: "", moneda: "BS", dias: "", fechaVencimiento: "", tiempo: "", notas: "" });
    } catch (e: any) {
      setEr(e?.message || "Error");
    }
  }

  return (
    <PantallaAdmin titulo="Préstamos" activo="prestamos">

      <SearchBar value={q} onChange={setQ} />
      <View style={{ flexDirection: "row" }}>
        {["todos", "activo", "atrasado", "pagado"].map((f) => (
          <Chip key={f} activo={filtro === f} label={f.charAt(0).toUpperCase() + f.slice(1)} onPress={() => setFiltro(f)} />
        ))}
      </View>

      {visibles.length === 0 && <Empty mensaje="No hay préstamos" />}
      {visibles.map((p: any) => (
        <Pressable key={p._id} onPress={() => setDetalle(p)}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.clienteBox}>
                <View style={styles.avatarP}>
                  <Ionicons name="person" size={16} color="#4F46E5" />
                </View>
                <Text style={styles.nombre} numberOfLines={1}>{p.nombre}</Text>
              </View>
              <Badge estado={p.estadoCalc} />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View>
                <Text style={styles.metaText}>Monto total</Text>
                <Text style={styles.montoPrincipal}>{p.moneda} {fmt(p.monto)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.metaText}>Deuda</Text>
                <Text style={[styles.montoPrincipal, { fontSize: 18, color: '#34D399' }]}>{p.moneda} {fmt(p.saldo)}</Text>
              </View>
            </View>

            <View style={styles.metaBox}>
              <Text style={styles.metaText}>
                <Ionicons name="calendar-outline" size={12} /> {p.fechaVencimiento || "—"}
              </Text>
              {p.estadoCalc === "atrasado" && (
                <Text style={{ color: COLORS.rojo, fontWeight: "700", fontSize: 12 }}>
                  ⚠ {p.diasVencido} días · Mora {fmt(p.mora)}
                </Text>
              )}
            </View>
          </View>
        </Pressable>
      ))}

      {pagina?.hayMas ? (
        <Button
          title={`Cargar más (${pagina.total} en total)`}
          variant="ghost"
          onPress={() => setLimite((l) => l + 20)}
        />
      ) : null}
      {pagina?.total ? (
        <Text style={styles.metaText}>
          Mostrando {visibles.length} de {pagina.total} préstamos
        </Text>
      ) : null}

      <Fab titulo="Préstamo" onPress={() => setModalNuevo(true)} />

      {/* ── Formulario nuevo préstamo ── */}
      <ModalSheet visible={modalNuevo} onClose={() => setModalNuevo(false)} title="Nuevo préstamo">
        <Select
          label="Cliente (opcional)"
          value={form.cliente || ""}
          onChange={(v) => setForm({ ...form, cliente: v })}
          options={clientesOpts}
        />
        <Input
          label="Nombre (si no eliges cliente)"
          value={form.nombre || ""}
          onChangeText={(t) => setForm({ ...form, nombre: t })}
        />
        <Input label="Monto *" value={form.monto} onChangeText={(t) => setForm({ ...form, monto: t })} keyboardType="numeric" />
        <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Input label="Tasa %" value={form.tasa} onChangeText={(t) => setForm({ ...form, tasa: t })} keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Días plazo" value={form.dias} onChangeText={(t) => setForm({ ...form, dias: t })} keyboardType="numeric" />
          </View>
        </View>
        <Select
          label="Moneda"
          value={form.moneda}
          onChange={(v) => setForm({ ...form, moneda: v })}
          options={Object.keys(MONEDAS)}
          optionsLabel={MONEDAS}
        />
        <Input label="Fecha del préstamo (AAAA-MM-DD)" value={form.fecha || ""} onChangeText={(t) => setForm({ ...form, fecha: t })} />
        <Input label="Fecha de vencimiento (AAAA-MM-DD)" value={form.fechaVencimiento || ""} onChangeText={(t) => setForm({ ...form, fechaVencimiento: t })} />
        <Input label="Tiempo (ej. mensual)" value={form.tiempo || ""} onChangeText={(t) => setForm({ ...form, tiempo: t })} />
        <Input label="Notas" value={form.notas || ""} onChangeText={(t) => setForm({ ...form, notas: t })} multiline />
        {er ? <Text style={{ color: COLORS.rojo, marginBottom: 8 }}>{er}</Text> : null}
        <Button title="Guardar préstamo" onPress={guardarNuevo} />
      </ModalSheet>

      {/* ── Detalle del préstamo ── */}
      <ModalSheet visible={!!detalle} onClose={() => setDetalle(null)} title={detalle?.nombre || ""}>
        {detalle && (
          <View style={{ paddingBottom: 20 }}>
            <View style={styles.modalHeader}>
              <Badge estado={detalle.estadoCalc} />
              <Text style={styles.modalMonto}>{detalle.moneda} {fmt(detalle.saldo)}</Text>
              <Text style={styles.metaText}>Saldo pendiente</Text>
            </View>

            <View style={styles.gridDetalles}>
              <View style={styles.boxDetalle}>
                <Text style={styles.boxLabel}>Monto Inicial</Text>
                <Text style={styles.boxValue}>{detalle.moneda} {fmt(detalle.monto)}</Text>
              </View>
              <View style={styles.boxDetalle}>
                <Text style={styles.boxLabel}>Deuda Total</Text>
                <Text style={styles.boxValue}>{detalle.moneda} {fmt(detalle.deudaTotal)}</Text>
              </View>
              <View style={styles.boxDetalle}>
                <Text style={styles.boxLabel}>Pagado</Text>
                <Text style={[styles.boxValue, { color: '#34D399' }]}>{detalle.moneda} {fmt(detalle.totalPagos)}</Text>
              </View>
              <View style={styles.boxDetalle}>
                <Text style={styles.boxLabel}>Mora</Text>
                <Text style={[styles.boxValue, { color: '#EF4444' }]}>{detalle.moneda} {fmt(detalle.mora)}</Text>
              </View>
            </View>

            <Row label="Fecha del préstamo" value={detalle.fechaPrestamo || "—"} />
            <Row label="Vencimiento" value={detalle.fechaVencimiento || "—"} />
            <Row label="Tasa de interés" value={`${detalle.tasaInteres}%`} />
            <Row label="Total a cobrar" value={`${detalle.moneda} ${fmt(detalle.totalAdeudado)}`} />
            {detalle.notas && <Row label="Notas" value={detalle.notas} />}

            <Text style={styles.sectionTitle}>Historial de pagos</Text>
            {(!detalle.pagos || detalle.pagos.length === 0) && (
              <Text style={{ color: '#94A3B8', marginBottom: 16 }}>No hay pagos registrados.</Text>
            )}
            {detalle.pagos && detalle.pagos.map((pg: any) => (
              <View key={pg._id} style={styles.pagoCard}>
                <View>
                  <Text style={{ fontWeight: "800", color: '#0F172A', fontSize: 16 }}>{detalle.moneda} {fmt(pg.monto)}</Text>
                  <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>
                    <Ionicons name="calendar-outline" size={10} /> {pg.fecha}{pg.notas ? ` · ${pg.notas}` : ""}
                  </Text>
                </View>
                <Pressable onPress={() => eliminarPago({ id: pg._id })} style={{ padding: 6 }}>
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </Pressable>
              </View>
            ))}

            <View style={{ gap: 10, marginTop: 16 }}>
              <Button title="Registrar nuevo pago" onPress={() => { setModalPagar(detalle); setDetalle(null); }} />
              {detalle.saldo > 0 ? (
                <>
                  <Button
                    title="Renovar (prorrogar vencimiento)"
                    variant="secondary"
                    onPress={() => { setModalRenovar(detalle); setDetalle(null); }}
                  />
                  <Button
                    title="Condonar saldo"
                    variant="outline"
                    onPress={() => { setConfCondonar(detalle); setDetalle(null); }}
                  />
                </>
              ) : null}
              <Button title="Eliminar préstamo" variant="danger" onPress={() => { setConfEliminar(detalle); setDetalle(null); }} />
            </View>
          </View>
        )}
      </ModalSheet>

      {/* ── Registrar pago ── */}
      <ModalSheet visible={!!modalPagar} onClose={() => setModalPagar(null)} title={`Pago ${modalPagar?.nombre || ""}`}>
        {modalPagar && (
          <>
            <Input label={`Monto (${modalPagar.moneda}) *`} value={form.pagoMonto || ""} onChangeText={(t) => setForm({ ...form, pagoMonto: t })} keyboardType="numeric" />
            <Input label="Fecha (AAAA-MM-DD)" value={form.pagoFecha || ""} onChangeText={(t) => setForm({ ...form, pagoFecha: t })} />
            <Input label="Notas" value={form.pagoNotas || ""} onChangeText={(t) => setForm({ ...form, pagoNotas: t })} />
            <Button
              title="Guardar pago"
              onPress={async () => {
                try {
                  await registrarPago({ prestamoId: modalPagar._id, monto: Number(form.pagoMonto), fecha: form.pagoFecha || undefined, notas: form.pagoNotas || undefined });
                  setModalPagar(null);
                  setForm((f: any) => ({ ...f, pagoMonto: "", pagoFecha: "", pagoNotas: "" }));
                } catch (e: any) {
                  setEr(e?.message || "Error");
                }
              }}
            />
          </>
        )}
      </ModalSheet>

      {/* ── Renovar (prórroga) ── */}
      <ModalSheet
        visible={!!modalRenovar}
        onClose={() => setModalRenovar(null)}
        title={`Renovar ${modalRenovar?.nombre || ""}`}
      >
        {modalRenovar && (
          <>
            <Text style={styles.metaText}>
              Vence {modalRenovar.fechaVencimiento || "—"} · saldo {modalRenovar.moneda} {fmt(modalRenovar.saldo)}
            </Text>
            <View style={{ height: 10 }} />
            <Input
              label="Días a prorrogar *"
              value={form.renovarDias || ""}
              onChangeText={(t) => setForm({ ...form, renovarDias: t })}
              keyboardType="numeric"
              placeholder="Ej: 15"
            />
            <Input
              label="Motivo (opcional)"
              value={form.renovarNota || ""}
              onChangeText={(t) => setForm({ ...form, renovarNota: t })}
            />
            <Button
              title="Prorrogar"
              onPress={async () => {
                setEr("");
                try {
                  await renovar({
                    id: modalRenovar._id,
                    dias: Number(form.renovarDias),
                    notas: form.renovarNota || undefined,
                  });
                  setModalRenovar(null);
                  setForm((f: any) => ({ ...f, renovarDias: "", renovarNota: "" }));
                } catch (e: any) {
                  setEr(e?.message || "Error");
                }
              }}
            />
            <View style={{ height: 8 }} />
            <Text style={styles.metaText}>
              La prórroga solo mueve la fecha de vencimiento y queda anotada en las notas y la bitácora.
              No cambia el saldo.
            </Text>
          </>
        )}
      </ModalSheet>

      <Confirmar
        visible={!!confCondonar}
        titulo="Condonar el saldo"
        mensaje={`Se perdonará ${confCondonar?.moneda || ""} ${fmt(confCondonar?.saldo || 0)} a ${
          confCondonar?.nombre || ""
        }. Quedará registrado como condonación en la bitácora.`}
        onCancel={() => setConfCondonar(null)}
        onConfirm={async () => {
          if (confCondonar) {
            try {
              await condonar({ id: confCondonar._id, notas: "Condonación de saldo" });
            } catch (e: any) {
              setEr(e?.message || "Error");
            }
          }
          setConfCondonar(null);
        }}
      />

      <Confirmar
        visible={!!confEliminar}
        titulo="¿Eliminar este préstamo?"
        mensaje="Se eliminarán también sus pagos y recordatorios."
        onCancel={() => setConfEliminar(null)}
        onConfirm={() => {
          if (confEliminar) remove({ id: confEliminar._id });
          setConfEliminar(null);
        }}
        peligro
      />
    </PantallaAdmin>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  clienteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  avatarP: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nombre: { fontSize: 16, fontWeight: "800", color: '#0F172A' },
  montoPrincipal: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
  },
  metaBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  metaText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  
  // Modal de detalles
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalMonto: {
    fontSize: 36,
    fontWeight: '900',
    color: '#0F172A',
    marginVertical: 6,
  },
  gridDetalles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  boxDetalle: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    width: '48%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  boxLabel: { fontSize: 11, color: '#64748B', fontWeight: '700', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 },
  boxValue: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 12, marginTop: 16 },
  pagoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
});
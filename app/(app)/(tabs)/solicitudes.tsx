import React, { useState } from "react";
import { View, Text, StyleSheet, Image, Pressable, TouchableOpacity } from "react-native";
import { useMutation, useQuery } from "../../../lib/api";
import { api } from "../../../lib/api";
import {
  Card, Row, SectionTitle, Button, Input, Badge, Chip, Empty,
  ModalSheet, Confirmar, COLORS, fmt,
} from "../../../lib/ui";
import { PantallaAdmin } from "../../../lib/pantalla-admin";

type Seg = "registros" | "prestamos" | "pagos";

export default function Solicitudes() {
  const [seg, setSeg] = useState<Seg>("registros");
  const [estadoReg, setEstadoReg] = useState<"pendiente" | "rechazado">("pendiente");
  const [estadoPagos, setEstadoPagos] = useState<"pendiente" | "todos">("pendiente");

  const pendientes = useQuery(api.solicitudes.pendientes);
  const rechazados = useQuery(api.solicitudes.rechazados);
  const solPrestamo = useQuery(api.solicitudes.solicitudesPrestamo);
  const pagosCliente = useQuery(api.pagosCliente.list, { estado: estadoPagos === "pendiente" ? "pendiente" : undefined });

  const aprobar = useMutation(api.solicitudes.aprobar);
  const rechazar = useMutation(api.solicitudes.rechazar);
  const aprobarSP = useMutation(api.solicitudes.aprobarSolicitudPrestamo);
  const rechazarSP = useMutation(api.solicitudes.rechazarSolicitudPrestamo);
  const personalizarYAprobar = useMutation(api.solicitudes.personalizarYAprobar);
  const aprobarPC = useMutation(api.pagosCliente.aprobar);
  const rechazarPC = useMutation(api.pagosCliente.rechazar);
  const actualizarEstrellas = useMutation(api.clientes2.actualizarEstrellas);

  const [rechazo, setRechazo] = useState<any>(null);
  const [motivo, setMotivo] = useState("");
  const [conf, setConf] = useState<any>(null);

  // Modal personalizar préstamo
  const [spPersonalizar, setSpPersonalizar] = useState<any>(null);
  const [pTasa, setPTasa] = useState("");
  const [pFechaVenc, setPFechaVenc] = useState("");
  const [pEsCuotas, setPEsCuotas] = useState(false);
  const [pNumCuotas, setPNumCuotas] = useState("4");
  const [pError, setPError] = useState("");
  const [pCargando, setPCargando] = useState(false);

  // Modal estrellas
  const [spEstrellas, setSpEstrellas] = useState<any>(null);
  const [nuevasEstrellas, setNuevasEstrellas] = useState("");

  const registros = estadoReg === "pendiente" ? pendientes || [] : rechazados || [];

  function abrirPersonalizar(sp: any) {
    setSpPersonalizar(sp);
    setPTasa(String(sp.tasaInteres ?? ""));
    setPFechaVenc("");
    setPEsCuotas(!!sp.esCuotas);
    setPNumCuotas(String(sp.numeroCuotas || 4));
    setPError("");
  }

  async function confirmarPersonalizar() {
    if (!spPersonalizar) return;
    setPError("");
    setPCargando(true);
    try {
      await personalizarYAprobar({
        id: spPersonalizar._id,
        tasaInteres: pTasa ? Number(pTasa) : undefined,
        fechaVencimiento: pFechaVenc || undefined,
        esCuotas: pEsCuotas,
        numeroCuotas: pEsCuotas ? Number(pNumCuotas) : 1,
      });
      setSpPersonalizar(null);
    } catch (e: any) {
      setPError(e?.message || "Error al aprobar");
    } finally {
      setPCargando(false);
    }
  }

  return (
    <PantallaAdmin titulo="Solicitudes" activo="solicitudes">

      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        <Chip activo={seg === "registros"} label="Registros" onPress={() => setSeg("registros")} />
        <Chip activo={seg === "prestamos"} label="Solic. préstamo" onPress={() => setSeg("prestamos")} />
        <Chip activo={seg === "pagos"} label="Pagos clientes" onPress={() => setSeg("pagos")} />
      </View>

      {/* ───────── Registros ───────── */}
      {seg === "registros" && (
        <>
          <View style={{ flexDirection: "row", marginTop: 6 }}>
            <Chip activo={estadoReg === "pendiente"} label="Pendientes" onPress={() => setEstadoReg("pendiente")} />
            <Chip activo={estadoReg === "rechazado"} label="Rechazados" onPress={() => setEstadoReg("rechazado")} />
          </View>
          {registros.length === 0 && <Empty mensaje="Sin solicitudes" />}
          {registros.map((s: any) => (
            <Card key={s._id} style={styles.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={styles.nombre}>{s.nombre} {s.apellido}</Text>
                <Badge estado={s.estado} />
              </View>
              <Row label="Cédula" value={s.cedula} />
              <Row label="Teléfono" value={s.telefono || "—"} />
              {s.edad ? <Row label="Edad" value={String(s.edad)} /> : null}
              {s.ubicacion ? <Row label="Ubicación" value={s.ubicacion} /> : null}
              {s.referidoPor ? <Row label="Referido por" value={s.referidoPor} /> : null}
              <Row label="Recibida" value={s.fechaCreacion} />
              {s.motivoRechazo ? <Row label="Motivo" value={s.motivoRechazo} /> : null}
              {(s.fotoFront || s.fotoBack) && (
                <View style={{ flexDirection: "row", gap: 8, marginVertical: 6 }}>
                  {s.fotoFront && <Image source={{ uri: s.fotoFront }} style={styles.foto} />}
                  {s.fotoBack && <Image source={{ uri: s.fotoBack }} style={styles.foto} />}
                </View>
              )}
              {s.estado === "pendiente" && (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}><Button small title="Aprobar" onPress={() => aprobar({ id: s._id })} /></View>
                  <View style={{ flex: 1 }}><Button small variant="danger" title="Rechazar" onPress={() => { setRechazo(s); setMotivo(""); }} /></View>
                </View>
              )}
            </Card>
          ))}
        </>
      )}

      {/* ───────── Solicitudes de préstamo ───────── */}
      {seg === "prestamos" && (
        <>
          {solPrestamo?.length === 0 && <Empty mensaje="Sin solicitudes de préstamo" />}
          {solPrestamo?.map((sp: any) => (
            <Card key={sp._id} style={styles.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={styles.nombre}>{sp.nombre_completo}</Text>
                <Badge estado={sp.estado} />
              </View>
              <Row label="Monto" value={`${sp.moneda.toUpperCase()} ${fmt(sp.monto)}`} />
              <Row label="Método de pago" value={sp.metodoPago.replace("_", " ")} />
              <Row label="Tasa" value={`${sp.tasaInteres}%`} />
              {sp.esCuotas ? (
                <Row label="Modalidad" value={`${sp.numeroCuotas} cuotas`} />
              ) : (
                <Row label="Modalidad" value="Pago único" />
              )}
              <Row label="Recibida" value={sp.fechaCreacion} />
              {sp.motivoRechazo ? <Row label="Motivo" value={sp.motivoRechazo} /> : null}

              {sp.estado === "pendiente" && (
                <>
                  {/* Botón personalizar (abre modal) */}
                  <TouchableOpacity
                    style={styles.btnPersonalizar}
                    onPress={() => abrirPersonalizar(sp)}
                  >
                    <Text style={styles.btnPersonalizarTxt}>⚙️ Personalizar y aprobar</Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                    <View style={{ flex: 1 }}>
                      <Button
                        small
                        title="Aprobar (tal como está)"
                        onPress={() => aprobarSP({ id: sp._id })}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        small
                        variant="danger"
                        title="Rechazar"
                        onPress={() => { setRechazo(sp); setMotivo(""); }}
                      />
                    </View>
                  </View>

                  {/* Botón asignar estrellas */}
                  <TouchableOpacity
                    style={styles.btnEstrellas}
                    onPress={() => {
                      setSpEstrellas(sp);
                      setNuevasEstrellas("");
                    }}
                  >
                    <Text style={styles.btnEstrellasTxt}>⭐ Gestionar estrellas del cliente</Text>
                  </TouchableOpacity>
                </>
              )}
            </Card>
          ))}
        </>
      )}

      {/* ───────── Pagos de clientes ───────── */}
      {seg === "pagos" && (
        <>
          <View style={{ flexDirection: "row", marginTop: 6 }}>
            <Chip activo={estadoPagos === "pendiente"} label="Pendientes" onPress={() => setEstadoPagos("pendiente")} />
            <Chip activo={estadoPagos === "todos"} label="Todos" onPress={() => setEstadoPagos("todos")} />
          </View>
          {pagosCliente?.length === 0 && <Empty mensaje="Sin pagos de clientes" />}
          {pagosCliente?.map((pc: any) => (
            <View key={pc._id} style={[styles.card, pc.estado === "pendiente" && styles.cardPendiente]}>
              {pc.estado === "pendiente" && (
                <View style={styles.alertaBanner}>
                  <Text style={styles.alertaTexto}>⏳ Abono en espera de aprobación</Text>
                </View>
              )}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nombre}>{pc.nombre}</Text>
                  <Text style={{ color: "#64748B", fontSize: 12, marginTop: 2 }}>{pc.nombre_c} {pc.apellido_c}</Text>
                </View>
                <Badge estado={pc.estado} />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                <View>
                  <Text style={{ fontSize: 11, color: "#64748B", fontWeight: "700", textTransform: "uppercase" }}>Monto</Text>
                  <Text style={{ fontSize: 22, fontWeight: "900", color: pc.estado === "pendiente" ? "#F59E0B" : "#0F172A" }}>
                    {pc.moneda} {fmt(pc.monto)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 11, color: "#64748B", fontWeight: "700", textTransform: "uppercase" }}>Método</Text>
                  <Text style={{ fontWeight: "700", color: "#0F172A" }}>{pc.metodo_label}</Text>
                </View>
              </View>
              {pc.referencia ? <Row label="Referencia" value={pc.referencia} /> : null}
              <Row label="Fecha de pago" value={pc.fechaPago} />
              {pc.motivoRechazo ? <Row label="Motivo rechazo" value={pc.motivoRechazo} /> : null}
              {pc.comprobante && <Image source={{ uri: pc.comprobante }} style={styles.foto} />}
              {pc.estado === "pendiente" && (
                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Button small title="✓ Aprobar abono" onPress={() => setConf({ tipo: "pc", fun: aprobarPC, id: pc._id })} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button small variant="danger" title="✗ Rechazar" onPress={() => { setRechazo(pc); setMotivo(""); }} />
                  </View>
                </View>
              )}
            </View>
          ))}
        </>
      )}

      {/* ── Rechazo (con motivo) ── */}
      <ModalSheet visible={!!rechazo} onClose={() => setRechazo(null)} title="Rechazar solicitud">
        <Input label="Motivo del rechazo" value={motivo} onChangeText={setMotivo} multiline />
        <Button
          title="Confirmar rechazo"
          variant="danger"
          onPress={() => {
            const r = rechazo;
            const m = motivo;
            setRechazo(null);
            if (r && r.clienteId !== undefined && r.metodoPago !== undefined) rechazarSP({ id: r._id, motivo: m });
            else if (r && r.prestamoId !== undefined && r.metodo !== undefined) rechazarPC({ id: r._id, motivo: m });
            else rechazar({ id: r?._id, motivo: m });
          }}
        />
      </ModalSheet>

      {/* ── Modal personalizar préstamo ── */}
      <ModalSheet
        visible={!!spPersonalizar}
        onClose={() => setSpPersonalizar(null)}
        title="Personalizar préstamo"
      >
        {spPersonalizar && (
          <>
            <View style={styles.personalizarInfo}>
              <Text style={styles.personalizarCliente}>{spPersonalizar.nombre_completo}</Text>
              <Text style={styles.personalizarMonto}>
                {spPersonalizar.moneda?.toUpperCase()} {fmt(spPersonalizar.monto)}
              </Text>
            </View>

            <Input
              label="Tasa de interés (%)"
              value={pTasa}
              onChangeText={setPTasa}
              keyboardType="decimal-pad"
              placeholder={`Actual: ${spPersonalizar.tasaInteres}%`}
            />
            <Input
              label="Fecha de vencimiento (YYYY-MM-DD)"
              value={pFechaVenc}
              onChangeText={setPFechaVenc}
              placeholder="Ej: 2026-11-01"
            />

            {/* Modalidad cuotas */}
            <Text style={styles.cuotasLabel}>Modalidad de pago</Text>
            <View style={styles.cuotasToggleRow}>
              <TouchableOpacity
                style={[styles.cuotasBtn, !pEsCuotas && styles.cuotasBtnActivo]}
                onPress={() => setPEsCuotas(false)}
              >
                <Text style={[styles.cuotasBtnTxt, !pEsCuotas && styles.cuotasBtnTxtActivo]}>Pago único</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cuotasBtn, pEsCuotas && styles.cuotasBtnActivo]}
                onPress={() => setPEsCuotas(true)}
              >
                <Text style={[styles.cuotasBtnTxt, pEsCuotas && styles.cuotasBtnTxtActivo]}>Por cuotas</Text>
              </TouchableOpacity>
            </View>

            {pEsCuotas && (
              <Input
                label="Número de cuotas"
                value={pNumCuotas}
                onChangeText={setPNumCuotas}
                keyboardType="numeric"
                placeholder="Ej: 4"
              />
            )}

            {pError ? <Text style={{ color: COLORS.rojo, marginBottom: 8, fontWeight: "600" }}>{pError}</Text> : null}

            <Button
              title={pCargando ? "Aprobando..." : "✅ Aprobar con estos términos"}
              onPress={confirmarPersonalizar}
              loading={pCargando}
            />
          </>
        )}
      </ModalSheet>

      {/* ── Modal estrellas ── */}
      <ModalSheet
        visible={!!spEstrellas}
        onClose={() => setSpEstrellas(null)}
        title="Gestionar estrellas"
      >
        {spEstrellas && (
          <>
            <Text style={{ fontSize: 15, fontWeight: "700", color: COLORS.texto, marginBottom: 4 }}>
              {spEstrellas.nombre_completo}
            </Text>
            <Text style={{ color: COLORS.textoSuave, fontSize: 13, marginBottom: 16 }}>
              Las estrellas definen cuántas cuotas puede solicitar el cliente. 5⭐ = 4 cuotas, 8⭐ = 8 cuotas, etc.
            </Text>
            <Input
              label="Número de estrellas (0–100)"
              value={nuevasEstrellas}
              onChangeText={setNuevasEstrellas}
              keyboardType="numeric"
              placeholder="Ej: 5"
            />
            {/* Vista previa rápida */}
            <View style={styles.estrellasPreview}>
              {[1,2,3,4,5,6,7,8,9,10,11,12].map((n) => (
                <Text key={n} style={[styles.estrellaSmall, n <= Number(nuevasEstrellas) && styles.estrellaSmallActiva]}>★</Text>
              ))}
            </View>
            <Button
              title="Guardar estrellas"
              onPress={async () => {
                const sp = spEstrellas;
                setSpEstrellas(null);
                await actualizarEstrellas({ clienteId: sp.clienteId, estrellas: Number(nuevasEstrellas) || 0 });
              }}
            />
          </>
        )}
      </ModalSheet>

      <Confirmar
        visible={!!conf}
        titulo="¿Aprobar este pago?"
        mensaje="Se registrará el abono en el préstamo."
        onCancel={() => setConf(null)}
        onConfirm={() => {
          if (conf) conf.fun({ id: conf.id });
          setConf(null);
        }}
      />
    </PantallaAdmin>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
  },
  cardPendiente: {
    borderColor: '#FDE68A',
    borderWidth: 2,
  },
  alertaBanner: {
    backgroundColor: '#FEF3C7',
    marginHorizontal: -16,
    marginTop: -16,
    marginBottom: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  alertaTexto: {
    color: '#92400E',
    fontWeight: '700',
    fontSize: 13,
  },
  nombre: { fontSize: 16, fontWeight: "800", color: COLORS.texto, flexShrink: 1 },
  foto: { width: 90, height: 60, borderRadius: 8, backgroundColor: COLORS.grisClaro },

  btnPersonalizar: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  btnPersonalizarTxt: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  btnEstrellas: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  btnEstrellasTxt: {
    color: '#D97706',
    fontWeight: '700',
    fontSize: 13,
  },

  // Modal personalizar
  personalizarInfo: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  personalizarCliente: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  personalizarMonto: {
    fontSize: 22,
    fontWeight: '900',
    color: '#10B981',
    marginTop: 4,
  },
  cuotasLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textoSuave,
    marginBottom: 8,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cuotasToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    gap: 4,
    marginBottom: 12,
  },
  cuotasBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  cuotasBtnActivo: {
    backgroundColor: '#0F172A',
  },
  cuotasBtnTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  cuotasBtnTxtActivo: {
    color: '#FFFFFF',
  },

  // Estrellas preview
  estrellasPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 16,
  },
  estrellaSmall: {
    fontSize: 20,
    color: '#E2E8F0',
  },
  estrellaSmallActiva: {
    color: '#F59E0B',
  },
});
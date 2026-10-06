import React, { useState } from "react";
import { Text, StyleSheet, View, TouchableOpacity } from "react-native";
import { api, useMutation, useQuery } from "../../lib/api";
import { PantallaCliente } from "../../lib/pantalla-cliente";
import { useSesion } from "../../lib/sesion";
import { Button, Card, COLORS, Input, Select } from "../../lib/ui";

const METODOS = { pago_movil: "Pago Móvil", zelle: "Zelle", efectivo: "Efectivo" };
const MONEDAS = {
  bs: "Bolívares (Bs.)",
  usd: "Dólares (USD)",
  eur: "Euros (EUR)",
  cop: "Pesos colombianos (COP)",
  clp: "Pesos chilenos (CLP)",
};
type Moneda = keyof typeof MONEDAS;
type Metodo = keyof typeof METODOS;

function nivelLabel(estrellas: number) {
  if (estrellas === 0) return "Sin nivel";
  if (estrellas < 5) return `${estrellas} ⭐`;
  return `${estrellas} ⭐`;
}

function maxCuotasDeEstrellas(estrellas: number) {
  return estrellas >= 5 ? estrellas : 0;
}

function generarOpcionesCuotas(max: number): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  // múltiplos de 4 hasta el máximo
  for (let i = 4; i <= max; i += 4) {
    opts.push({ value: String(i), label: `${i} cuotas` });
  }
  // si el máximo no es múltiplo de 4, agregar el máximo
  if (max % 4 !== 0 && max >= 5) {
    opts.push({ value: String(max), label: `${max} cuotas (máx)` });
  }
  if (opts.length === 0 && max >= 5) {
    opts.push({ value: String(max), label: `${max} cuotas` });
  }
  return opts;
}

export default function Solicitar() {
  const { sesion } = useSesion();
  const clienteId = sesion?.rol === "cliente" ? sesion.clienteId : undefined;
  const me: any = useQuery(api.portalCliente.me, clienteId ? { clienteId } : "skip");
  const cfg: any = useQuery(api.settings.getConfigCliente, clienteId ? { clienteId } : "skip");
  const resumen: any = useQuery(api.portalCliente.resumen, clienteId ? { clienteId } : "skip");
  const estrellasData: any = useQuery(api.portalCliente.getEstrellas, clienteId ? { clienteId } : "skip");

  const solicitar = useMutation(api.portalCliente.solicitarPrestamo);

  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState<Metodo>("pago_movil");
  const [moneda, setMoneda] = useState<Moneda>("bs");
  const [esCuotas, setEsCuotas] = useState(false);
  const [cuotasSeleccionadas, setCuotasSeleccionadas] = useState("4");
  const [er, setEr] = useState("");
  const [ok, setOk] = useState("");
  const [esperando, setEsperando] = useState(false);

  const estrellas = estrellasData?.estrellas ?? 0;
  const maxCuotas = maxCuotasDeEstrellas(estrellas);
  const opcionesCuotas = generarOpcionesCuotas(maxCuotas);

  // Detectar si tiene préstamo activo
  const tienePrestamoActivo = (resumen?.active ?? 0) > 0 || (resumen?.overdue ?? 0) > 0;

  async function enviar() {
    setEr("");
    setOk("");
    setEsperando(true);
    try {
      await solicitar({
        clienteId: clienteId!,
        monto: Number(monto),
        metodoPago: metodo,
        moneda,
        esCuotas,
        numeroCuotas: esCuotas ? Number(cuotasSeleccionadas) : 1,
      });
      setOk("¡Solicitud enviada! El administrador la revisará y te contactará. ✅");
      setMonto("");
      setEsCuotas(false);
    } catch (e: any) {
      setEr(e?.message || "Error al solicitar");
    } finally {
      setEsperando(false);
    }
  }

  return (
    <PantallaCliente
      titulo="Solicitar préstamo"
      subtitulo={me ? `Hola ${me.nombre}` : undefined}
      activo="solicitar"
    >
      {/* Tarjeta de nivel */}
      <Card style={styles.nivelCard}>
        <View style={styles.nivelRow}>
          <View>
            <Text style={styles.nivelLabel}>Tu nivel</Text>
            <Text style={styles.nivelValor}>{nivelLabel(estrellas)}</Text>
          </View>
          <View style={styles.nivelInfo}>
            <Text style={styles.nivelSubtitulo}>
              {maxCuotas === 0
                ? "Alcanza 5 ⭐ para pagar en cuotas"
                : `Hasta ${maxCuotas} cuotas disponibles`}
            </Text>
          </View>
        </View>
        {/* Barra de estrellas visual */}
        <View style={styles.estrellasRow}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
            <Text key={n} style={[styles.estrella, n <= estrellas && styles.estrellaActiva]}>
              ★
            </Text>
          ))}
        </View>
      </Card>

      {/* Tarjeta de tasa */}
      <Card style={{ backgroundColor: COLORS.azulClaro, borderColor: COLORS.azul }}>
        <Text style={styles.info}>
          Tasa de interés actual: <Text style={{ fontWeight: "800" }}>{cfg?.tasa_dia ?? 0}%</Text>. La tasa
          de tu préstamo se calcula según tu historial.
        </Text>
      </Card>

      {/* Bloqueo si ya tiene préstamo activo */}
      {tienePrestamoActivo ? (
        <Card style={styles.bloqueadoCard}>
          <Text style={styles.bloqueadoIcon}>🔒</Text>
          <Text style={styles.bloqueadoTitulo}>Tienes un préstamo activo</Text>
          <Text style={styles.bloqueadoTexto}>
            Debes saldar tu préstamo actual antes de poder solicitar uno nuevo.
          </Text>
        </Card>
      ) : (
        <>
          {resumen?.pendingRequests ? (
            <Card>
              <Text style={styles.info}>
                Tienes {resumen.pendingRequests} solicitud(es) en revisión. Te avisaremos cuando se aprueben.
              </Text>
            </Card>
          ) : null}

          <Card>
            <Input
              label="Monto a solicitar *"
              value={monto}
              onChangeText={setMonto}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
            <Select
              label="Moneda"
              value={moneda}
              onChange={(v) => setMoneda(v as Moneda)}
              options={Object.keys(MONEDAS)}
              optionsLabel={MONEDAS}
            />
            <Select
              label="Método de pago que prefieres"
              value={metodo}
              onChange={(v) => setMetodo(v as Metodo)}
              options={Object.keys(METODOS)}
              optionsLabel={METODOS}
            />

            {/* Opción de cuotas si tiene estrellas suficientes */}
            {maxCuotas >= 5 && (
              <View style={styles.cuotasSection}>
                <Text style={styles.cuotasTitulo}>Modalidad de pago</Text>
                <View style={styles.cuotasToggleRow}>
                  <TouchableOpacity
                    style={[styles.cuotasBtn, !esCuotas && styles.cuotasBtnActivo]}
                    onPress={() => setEsCuotas(false)}
                  >
                    <Text style={[styles.cuotasBtnTxt, !esCuotas && styles.cuotasBtnTxtActivo]}>
                      Pago único
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.cuotasBtn, esCuotas && styles.cuotasBtnActivo]}
                    onPress={() => setEsCuotas(true)}
                  >
                    <Text style={[styles.cuotasBtnTxt, esCuotas && styles.cuotasBtnTxtActivo]}>
                      Por cuotas
                    </Text>
                  </TouchableOpacity>
                </View>

                {esCuotas && opcionesCuotas.length > 0 && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.cuotasLabel}>Número de cuotas</Text>
                    <View style={styles.cuotasOptsRow}>
                      {opcionesCuotas.map((op) => (
                        <TouchableOpacity
                          key={op.value}
                          style={[styles.cuotasOpt, cuotasSeleccionadas === op.value && styles.cuotasOptActivo]}
                          onPress={() => setCuotasSeleccionadas(op.value)}
                        >
                          <Text style={[styles.cuotasOptTxt, cuotasSeleccionadas === op.value && styles.cuotasOptTxtActivo]}>
                            {op.value}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={styles.cuotasHint}>
                      El admin definirá el monto exacto de cada cuota al aprobar.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </Card>

          {er ? <Text style={styles.er}>{er}</Text> : null}
          {ok ? <Text style={styles.ok}>{ok}</Text> : null}

          <Button title="Enviar solicitud" onPress={enviar} loading={esperando} style={{ marginTop: 4 }} />
        </>
      )}
    </PantallaCliente>
  );
}

const styles = StyleSheet.create({
  info: { color: COLORS.textoSuave, fontSize: 13, lineHeight: 19 },
  er: { color: COLORS.rojo, marginBottom: 10, fontWeight: "600" },
  ok: { color: COLORS.verde, marginBottom: 10, fontWeight: "700" },

  nivelCard: {
    backgroundColor: "#0F172A",
    borderColor: "#1E293B",
    marginBottom: 12,
  },
  nivelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  nivelLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  nivelValor: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 4,
  },
  nivelInfo: { flex: 1, alignItems: "flex-end" },
  nivelSubtitulo: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
  },
  estrellasRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  estrella: {
    fontSize: 20,
    color: "rgba(255,255,255,0.15)",
  },
  estrellaActiva: {
    color: "#F59E0B",
  },

  bloqueadoCard: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    alignItems: "center",
    paddingVertical: 28,
  },
  bloqueadoIcon: { fontSize: 40, marginBottom: 12 },
  bloqueadoTitulo: {
    fontSize: 17,
    fontWeight: "800",
    color: "#991B1B",
    marginBottom: 8,
    textAlign: "center",
  },
  bloqueadoTexto: {
    fontSize: 14,
    color: "#B91C1C",
    textAlign: "center",
    lineHeight: 20,
  },

  cuotasSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 16,
  },
  cuotasTitulo: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.texto,
    marginBottom: 10,
  },
  cuotasToggleRow: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  cuotasBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  cuotasBtnActivo: {
    backgroundColor: "#0F172A",
  },
  cuotasBtnTxt: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  cuotasBtnTxtActivo: {
    color: "#FFFFFF",
  },
  cuotasLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textoSuave,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cuotasOptsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  cuotasOpt: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 2,
    borderColor: "#E2E8F0",
  },
  cuotasOptActivo: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
  },
  cuotasOptTxt: {
    fontSize: 16,
    fontWeight: "800",
    color: "#64748B",
  },
  cuotasOptTxtActivo: {
    color: "#FFFFFF",
  },
  cuotasHint: {
    fontSize: 11,
    color: COLORS.textoSuave,
    marginTop: 8,
    fontStyle: "italic",
  },
});

import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { api, useQuery } from "../../lib/api";
import { PantallaCliente } from "../../lib/pantalla-cliente";
import { useSesion } from "../../lib/sesion";
import { Badge, Card, COLORS, fmtDinero, SectionTitle } from "../../lib/ui";

const DIAS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export default function CalendarioPagos() {
  const { sesion } = useSesion();
  const clienteId = sesion?.rol === "cliente" ? sesion.clienteId : undefined;
  const vencimientos: any[] = useQuery(
    api.portalCliente.calendario,
    clienteId ? { clienteId } : "skip"
  ) || [];

  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth()); // 0-11
  const [sel, setSel] = useState<string | null>(null);

  const pagosDelMes = useMemo(
    () => vencimientos.filter((v) => {
      const f = String(v.fechaVencimiento || "").slice(0, 10);
      return f.startsWith(`${anio}-${String(mes + 1).padStart(2, "0")}`);
    }),
    [vencimientos, anio, mes]
  );

  const porDia = useMemo(() => {
    const mapa: Record<string, any[]> = {};
    for (const v of pagosDelMes) {
      const d = String(v.fechaVencimiento).slice(8, 10);
      (mapa[d] = mapa[d] || []).push(v);
    }
    return mapa;
  }, [pagosDelMes]);

  // lunes = 0
  const primero = new Date(anio, mes, 1);
  const offset = (primero.getDay() + 6) % 7;
  const diasMes = new Date(anio, mes + 1, 0).getDate();
  const celdas: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: diasMes }, (_, i) => i + 1),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);

  const mover = (delta: number) => {
    const d = new Date(anio, mes + delta, 1);
    setAnio(d.getFullYear());
    setMes(d.getMonth());
  };

  const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(
    hoy.getDate()
  ).padStart(2, "0")}`;

  const delDia = sel ? vencimientos.filter((v) => String(v.fechaVencimiento).slice(0, 10) === sel) : [];

  return (
    <PantallaCliente
      titulo="Calendario de pagos"
      subtitulo={`${MESES[mes]} ${anio} · ${pagosDelMes.length} vencimientos`}
      activo="calendario"
    >
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={() => mover(-1)} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color={COLORS.azul} />
          </Pressable>
          <Text style={{ color: COLORS.azul, fontWeight: "800", fontSize: 16, textTransform: "capitalize" }}>
            {MESES[mes]} {anio}
          </Text>
          <Pressable onPress={() => mover(1)} hitSlop={10}>
            <Ionicons name="chevron-forward" size={22} color={COLORS.azul} />
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", marginTop: 14 }}>
          {DIAS.map((d) => (
            <Text
              key={d}
              style={{ flex: 1, textAlign: "center", color: COLORS.textoSuave, fontSize: 11, fontWeight: "700" }}
            >
              {d}
            </Text>
          ))}
        </View>

        {Array.from({ length: celdas.length / 7 }, (_, f) => (
          <View key={f} style={{ flexDirection: "row", marginTop: 6 }}>
            {celdas.slice(f * 7, f * 7 + 7).map((d, i) => {
              if (!d) return <View key={i} style={{ flex: 1, height: 42 }} />;
              const iso = `${anio}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const tiene = !!porDia[String(d)];
              const atrasado = tiene && iso < hoyISO && porDia[String(d)].some((v) => v.estado === "atrasado");
              return (
                <Pressable
                  key={i}
                  onPress={() => tiene && setSel(iso)}
                  style={{ flex: 1, height: 42, alignItems: "center", justifyContent: "center" }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor:
                        sel === iso ? COLORS.azul : tiene ? (atrasado ? COLORS.rojoClaro : COLORS.tealClaro) : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        color: sel === iso ? COLORS.blanco : atrasado ? COLORS.rojo : COLORS.texto,
                        fontWeight: tiene || iso === hoyISO ? "800" : "500",
                        fontSize: 13,
                        textDecorationLine: iso === hoyISO ? "underline" : "none",
                      }}
                    >
                      {d}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </Card>

      {sel ? (
        <>
          <SectionTitle>Pagos del {sel}</SectionTitle>
          {delDia.length === 0 ? (
            <Card>
              <Text style={{ color: COLORS.textoSuave, textAlign: "center" }}>Sin pagos para ese día.</Text>
            </Card>
          ) : (
            delDia.map((v) => (
              <Card key={v.prestamoId}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Text style={{ color: COLORS.texto, fontWeight: "700" }}>
                      {fmtDinero(v.saldo, v.moneda)}
                    </Text>
                    <Text style={{ color: COLORS.textoSuave, fontSize: 12 }}>
                      {v.tiempo || "cuota"} · préstamo de {fmtDinero(v.monto, v.moneda)}
                    </Text>
                  </View>
                  <Badge estado={v.estado} />
                </View>
              </Card>
            ))
          )}
        </>
      ) : (
        <>
          <SectionTitle>Pagos de {MESES[mes]}</SectionTitle>
          {pagosDelMes.length === 0 ? (
            <Card>
              <Text style={{ color: COLORS.textoSuave, textAlign: "center" }}>
                No hay vencimientos este mes.
              </Text>
            </Card>
          ) : (
            pagosDelMes.map((v) => (
              <Card key={v.prestamoId}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Text style={{ color: COLORS.texto, fontWeight: "700" }}>
                      {fmtDinero(v.saldo, v.moneda)}
                    </Text>
                    <Text style={{ color: COLORS.textoSuave, fontSize: 12 }}>
                      Vence {v.fechaVencimiento} · {v.dias >= 0 ? `en ${v.dias} días` : `hace ${-v.dias} días`}
                    </Text>
                  </View>
                  <Badge estado={v.estado} />
                </View>
              </Card>
            ))
          )}
        </>
      )}
    </PantallaCliente>
  );
}

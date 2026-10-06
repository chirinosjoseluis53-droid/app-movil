import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useQuery } from "../../lib/api";
import { api } from "../../lib/api";
import { Badge, Card, Chip, COLORS, Empty, SectionTitle, StatCard, fmt } from "../../lib/ui";
import { PantallaAdmin } from "../../lib/pantalla-admin";

const hoy = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const diffDias = (a: string, b: string): number => {
  const fa = new Date(`${a}T00:00:00`).getTime();
  const fb = new Date(`${b}T00:00:00`).getTime();
  return Math.round((fb - fa) / 86400000);
};

const etiqueta = (dias: number): string => {
  if (dias < 0) return `${Math.abs(dias)} día${Math.abs(dias) === 1 ? "" : "s"} de atraso`;
  if (dias === 0) return "Vence hoy";
  if (dias === 1) return "Vence mañana";
  return `En ${dias} días`;
};

const FILTROS = [
  { clave: "atrasados", label: "Atrasados" },
  { clave: "hoy", label: "Hoy" },
  { clave: "7", label: "7 días" },
  { clave: "30", label: "30 días" },
  { clave: "90", label: "90 días" },
  { clave: "todos", label: "Todos" },
];

export default function Calendario() {
  const lista = useQuery(api.prestamos.list, { q: undefined });
  const [filtro, setFiltro] = useState("30");

  const pendientes = useMemo(() => {
    const hoyStr = hoy();
    return (lista || []).filter(
      (p: any) => p.estadoCalc !== "pagado" && p.saldo > 0 && !!p.fechaVencimiento
    );
  }, [lista]);

  const visibles = useMemo(() => {
    const hoyStr = hoy();
    return pendientes
      .map((p: any) => ({ ...p, dias: diffDias(hoyStr, p.fechaVencimiento) }))
      .filter((p: any) => {
        if (filtro === "atrasados") return p.dias < 0;
        if (filtro === "hoy") return p.dias === 0;
        if (filtro === "todos") return true;
        return p.dias >= 0 && p.dias <= Number(filtro);
      })
      .sort((a: any, b: any) => a.fechaVencimiento.localeCompare(b.fechaVencimiento));
  }, [pendientes, filtro]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, any[]>();
    for (const p of visibles) {
      const lista = mapa.get(p.fechaVencimiento) || [];
      lista.push(p);
      mapa.set(p.fechaVencimiento, lista);
    }
    return [...mapa.entries()].map(([fecha, items]) => ({
      fecha,
      items,
      total: items.reduce((a: number, p: any) => a + (p.saldo || 0), 0),
    }));
  }, [visibles]);

  const atrasados = pendientes.filter((p: any) => diffDias(hoy(), p.fechaVencimiento) < 0);
  const hoyStr = hoy();
  const deHoy = pendientes.filter((p: any) => p.fechaVencimiento === hoyStr);
  const semana = pendientes.filter((p: any) => {
    const d = diffDias(hoyStr, p.fechaVencimiento);
    return d >= 0 && d <= 7;
  });

  const tituloFecha = (fecha: string) => {
    const d = new Date(`${fecha}T00:00:00`);
    return d.toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "long" });
  };

  return (
    <PantallaAdmin titulo="Calendario" subtitulo="Vencimientos de los préstamos" activo="calendario">
      <View style={styles.stats}>
        <View style={{ flex: 1 }}>
          <StatCard label="Atrasados" valor={String(atrasados.length)} sub="Préstamos" color={COLORS.rojo} />
        </View>
        <View style={{ flex: 1 }}>
          <StatCard label="Cobrar hoy" valor={String(deHoy.length)} sub="Préstamos" color={COLORS.naranja} />
        </View>
        <View style={{ flex: 1 }}>
          <StatCard label="7 días" valor={String(semana.length)} sub="Préstamos" color={COLORS.azul} />
        </View>
      </View>

      <View style={styles.chips}>
        {FILTROS.map((f) => (
          <Chip key={f.clave} activo={filtro === f.clave} label={f.label} onPress={() => setFiltro(f.clave)} />
        ))}
      </View>

      {grupos.length === 0 ? (
        <Empty mensaje="No hay vencimientos para este filtro." />
      ) : null}

      {grupos.map((g) => (
        <View key={g.fecha}>
          <SectionTitle style={styles.tituloGrupo}>
            {tituloFecha(g.fecha)} · {fmt(g.total)}
          </SectionTitle>
          {g.items.map((p: any) => (
            <Card key={p._id}>
              <View style={styles.fila}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nombre} numberOfLines={1}>
                    {p.nombre}
                  </Text>
                  <Text style={styles.sub}>
                    {p.moneda} {fmt(p.saldo)}
                    {p.mora ? ` · mora ${fmt(p.mora)}` : ""}
                  </Text>
                  <Text
                    style={[
                      styles.cuenta,
                      {
                        color:
                          p.dias < 0 ? COLORS.rojo : p.dias === 0 ? COLORS.naranja : COLORS.textoSuave,
                      },
                    ]}
                  >
                    {etiqueta(p.dias)}
                  </Text>
                </View>
                <Badge estado={p.estadoCalc} />
              </View>
            </Card>
          ))}
        </View>
      ))}
    </PantallaAdmin>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: "row", gap: 10, marginBottom: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  tituloGrupo: { textTransform: "capitalize", marginTop: 10, marginBottom: 8 },
  fila: { flexDirection: "row", alignItems: "center", gap: 10 },
  nombre: { fontWeight: "700", color: COLORS.texto, fontSize: 15 },
  sub: { color: COLORS.textoSuave, fontSize: 12, marginTop: 2 },
  cuenta: { fontSize: 12, marginTop: 4, fontWeight: "600" },
});

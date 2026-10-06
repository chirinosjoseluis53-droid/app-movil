import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { PantallaCliente } from "../../lib/pantalla-cliente";
import { api, useQuery } from "../../lib/api";
import { useSesion } from "../../lib/sesion";
import { Card, COLORS, fmtDinero, Input, SectionTitle, Select } from "../../lib/ui";

const MONEDAS = [
  { v: "BS", l: "Bolívares (Bs.)" },
  { v: "USD", l: "Dólares (USD)" },
  { v: "COP", l: "Pesos colombianos (COP)" },
  { v: "CLP", l: "Pesos chilenos (CLP)" },
];

const FRECUENCIAS = [
  { nombre: "Diaria", dias: 1 },
  { nombre: "Semanal", dias: 7 },
  { nombre: "Quincenal", dias: 15 },
  { nombre: "Mensual", dias: 30 },
];

export default function Calculadora() {
  const { sesion } = useSesion();
  const clienteId = sesion?.rol === "cliente" ? sesion.clienteId : undefined;
  const resumen: any = useQuery(api.portalCliente.resumen, clienteId ? { clienteId } : "skip");

  const [monto, setMonto] = useState("1000");
  const [tasa, setTasa] = useState(String(resumen?.tasa ?? 10));
  const [plazo, setPlazo] = useState("30");
  const [moneda, setMoneda] = useState("BS");

  const calc = useMemo(() => {
    const m = parseFloat(monto);
    const t = parseFloat(tasa);
    const p = parseInt(plazo, 10);
    if (!(m > 0) || !(t >= 0) || !(p > 0)) return null;
    const interes = (m * t) / 100;
    const total = m + interes;
    const diaria = total / p;
    const d = new Date();
    d.setDate(d.getDate() + p);
    const vencimiento = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    return { interes, total, diaria, vencimiento, plazo: p };
  }, [monto, tasa, plazo]);

  return (
    <PantallaCliente titulo="Calculadora" subtitulo="Simula el total a pagar" activo="calculadora">
      <Card>
        <Input
          label="Monto del préstamo"
          value={monto}
          onChangeText={setMonto}
          keyboardType="decimal-pad"
        />
        <Select
          label="Moneda"
          value={moneda}
          onChange={setMoneda}
          options={MONEDAS.map((m) => m.v)}
          optionsLabel={Object.fromEntries(MONEDAS.map((m) => [m.v, m.l]))}
        />
        <Input
          label="Interés (%)"
          value={tasa}
          onChangeText={setTasa}
          keyboardType="decimal-pad"
        />
        <Input
          label="Plazo (días)"
          value={plazo}
          onChangeText={setPlazo}
          keyboardType="number-pad"
        />
      </Card>

      <SectionTitle>Resultado</SectionTitle>
      {calc ? (
        <>
          <Card>
            <Fila label="Interés / ganancia" valor={fmtDinero(calc.interes, moneda)} />
            <Fila
              label="Total a pagar"
              valor={fmtDinero(calc.total, moneda)}
              destacado
            />
            <Fila label="Cuota diaria" valor={fmtDinero(calc.diaria, moneda)} />
            <Fila label="Vencimiento aprox." valor={calc.vencimiento} />
          </Card>

          <SectionTitle>Desglose de pagos</SectionTitle>
          <Card>
            <View style={{ flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.borde }}>
              <Text style={{ flex: 1, fontWeight: "700", color: COLORS.textoSuave, fontSize: 12 }}>
                Frecuencia
              </Text>
              <Text style={{ flex: 1.2, fontWeight: "700", color: COLORS.textoSuave, fontSize: 12, textAlign: "right" }}>
                Cuota estimada
              </Text>
            </View>
            <Fila label="Al contado" valor={fmtDinero(calc.total, moneda)} />
            {FRECUENCIAS.filter((f) => f.dias <= calc.plazo).map((f) => (
              <Fila
                key={f.nombre}
                label={f.nombre}
                valor={`${fmtDinero(calc.diaria * f.dias, moneda)} · ${f.dias} días`}
              />
            ))}
          </Card>
        </>
      ) : (
        <Card>
          <Text style={{ color: COLORS.textoSuave, textAlign: "center" }}>
            Completa los campos para calcular.
          </Text>
        </Card>
      )}

      <Text style={{ color: COLORS.gris, fontSize: 12, marginTop: 6 }}>
        Cálculo estimado: interés = monto × tasa / 100. El total a pagar es monto + interés. No incluye
        mora ni recargos por atraso.
      </Text>
    </PantallaCliente>
  );
}

function Fila({ label, valor, destacado }: { label: string; valor: string; destacado?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 8,
      }}
    >
      <Text style={{ color: destacado ? COLORS.azul : COLORS.textoSuave, flex: 1, fontWeight: destacado ? "700" : "400" }}>
        {label}
      </Text>
      <Text
        style={{
          color: destacado ? COLORS.azul : COLORS.texto,
          fontWeight: destacado ? "800" : "600",
          fontSize: destacado ? 17 : 14,
        }}
      >
        {valor}
      </Text>
    </View>
  );
}

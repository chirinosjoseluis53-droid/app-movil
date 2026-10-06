import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { PantallaAdmin } from "../../lib/pantalla-admin";
import { obtenerTasas, ResultadoTasas } from "../../lib/tasas";
import { useQuery } from "../../lib/api";
import { api } from "../../lib/api";
import { Bandera, Button, Card, COLORS, Row, SectionTitle, fmt } from "../../lib/ui";

export default function TasaDelDia() {
  const router = useRouter();
  const [datos, setDatos] = useState<ResultadoTasas | null>(null);
  const [cargando, setCargando] = useState(true);
  const interes = useQuery(api.interes.actual);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await obtenerTasas());
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const fecha = datos ? new Date(datos.momento) : new Date();
  const hora = fecha.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });
  const dia = fecha.toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "long" });

  return (
    <PantallaAdmin
      titulo="Tasa del día"
      subtitulo={`${dia} · ${hora}`}
      activo="tasa"
      onRefresh={cargar}
      recargando={cargando}
    >
      <Card style={{ backgroundColor: COLORS.azul, borderColor: COLORS.azul }}>
        <Text style={{ color: COLORS.azulClaro, fontSize: 13, fontWeight: "700" }}>Tasa de interés vigente</Text>
        <Text style={{ color: COLORS.blanco, fontSize: 40, fontWeight: "900", marginVertical: 2 }}>
          {fmt(interes?.tasa ?? 0)}%
        </Text>
        <Text style={{ color: COLORS.azulClaro, fontSize: 12 }}>
          {interes?.fecha === interes?.hoy ? "Registrada hoy" : `Última: ${interes?.fecha || "sin registro"}`} ·{" "}
          {interes?.prestamosQueLoUsan ?? 0} préstamos la usan
        </Text>
        <Text style={{ color: COLORS.azulClaro, fontSize: 12, marginTop: 6 }}>
          Es el interés TOTAL del préstamo, no diario ni mensual: 10% sobre 100 = 110 a pagar. Solo
          afecta a los préstamos que se creen desde ahora.
        </Text>
        <View style={{ height: 12 }} />
        <Button title="Administrar interés" variant="outline" onPress={() => router.push("/interes" as any)} />
      </Card>

      {cargando && !datos ? (
        <View style={{ padding: 40, alignItems: "center" }}>
          <ActivityIndicator color={COLORS.azul} />
          <Text style={{ color: COLORS.textoSuave, marginTop: 10 }}>Consultando tasas…</Text>
        </View>
      ) : null}

      {datos ? (
        <>
          {!datos.online ? (
            <Card style={{ backgroundColor: COLORS.naranjaClaro, borderColor: COLORS.naranja }}>
              <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                <Ionicons name="cloud-offline-outline" size={20} color={COLORS.naranja} />
                <Text style={{ color: COLORS.texto, fontSize: 13, flex: 1 }}>
                  Sin conexión: se muestran valores de referencia.
                </Text>
              </View>
            </Card>
          ) : null}

          <SectionTitle>Tasas de cambio</SectionTitle>
          {datos.monedas.map((m) => (
            <Card key={m.codigo}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <Bandera codigo={m.codigo} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: COLORS.texto, fontWeight: "700", fontSize: 15 }}>{m.nombre}</Text>
                  <Text style={{ color: COLORS.textoSuave, fontSize: 12 }}>
                    1 USD = {m.codigo === "USD" ? "1" : m.valor} {m.codigo}
                  </Text>
                </View>
                <Text style={{ color: COLORS.azul, fontWeight: "800", fontSize: 18 }}>
                  {m.codigo === "USD" ? "$1.00" : m.valor.toLocaleString("es-VE", { maximumFractionDigits: 2 })}
                </Text>
              </View>
            </Card>
          ))}

          <SectionTitle>Equivalencias</SectionTitle>
          <Card>
            {[10, 50, 100].map((usd) => (
              <View
                key={usd}
                style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 }}
              >
                <Text style={{ color: COLORS.textoSuave }}>{usd} USD</Text>
                {datos.monedas
                  .filter((m) => !m.referencia)
                  .map((m) => (
                    <Text key={m.codigo} style={{ color: COLORS.texto, fontWeight: "600" }}>
                      {m.bandera} {(usd * m.valor).toLocaleString("es-VE", { maximumFractionDigits: 0 })}
                    </Text>
                  ))}
              </View>
            ))}
          </Card>

          <SectionTitle>Referencias rápidas</SectionTitle>
          <Card>
            <Row label="Tasa de interés" value={`${fmt(interes?.tasa ?? 0)}%`} />
            <Row label="Tasa de mora" value="Ver en Ajustes" />
            <Row label="Moneda por defecto" value="Ver en Ajustes" />
          </Card>

          <Text style={{ color: COLORS.gris, fontSize: 11 }}>
            Fuente: {datos?.monedas[1]?.origen || "dolarapi / exchangerate-api"}
          </Text>
        </>
      ) : null}
    </PantallaAdmin>
  );
}

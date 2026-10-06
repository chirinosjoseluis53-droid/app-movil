import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { PantallaCliente } from "../../lib/pantalla-cliente";
import { obtenerTasas, ResultadoTasas } from "../../lib/tasas";
import { Bandera, Card, COLORS, SectionTitle } from "../../lib/ui";

export default function TasaDelDia() {
  const [datos, setDatos] = useState<ResultadoTasas | null>(null);
  const [cargando, setCargando] = useState(true);

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
    <PantallaCliente
      titulo="Tasa del día"
      subtitulo={`${dia} · ${hora}`}
      activo="tasa"
      onRefresh={cargar}
      recargando={cargando}
    >
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
        </>
      ) : null}

      <Text style={{ color: COLORS.gris, fontSize: 11, marginTop: 4 }}>
        Fuente: {datos?.monedas[1]?.origen || "dolarapi / exchangerate-api"}
      </Text>
    </PantallaCliente>
  );
}

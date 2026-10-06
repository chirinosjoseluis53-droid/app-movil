import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery } from "../../lib/api";
import { api } from "../../lib/api";
import {
  Button, Card, Chip, COLORS, Confirmar, Empty, Input, ModalSheet,
  Row, SectionTitle, StatCard, fmt,
} from "../../lib/ui";
import { PantallaAdmin } from "../../lib/pantalla-admin";

const hoy = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function Interes() {
  const actual = useQuery(api.interes.actual);
  const lista = useQuery(api.interes.list, { limite: 30 });
  const crear = useMutation(api.interes.crear);
  const actualizar = useMutation(api.interes.actualizar);
  const eliminar = useMutation(api.interes.eliminar);

  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [tasa, setTasa] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [nota, setNota] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aBorrar, setABorrar] = useState<any>(null);

  function abrirNuevo() {
    setEditando(null);
    setTasa(String(actual?.tasa ?? ""));
    setFecha(hoy());
    setNota("");
    setError("");
    setAbierto(true);
  }

  function abrirEdicion(row: any) {
    setEditando(row);
    setTasa(String(row.tasa));
    setFecha(String(row.fecha));
    setNota(row.nota || "");
    setError("");
    setAbierto(true);
  }

  async function guardar() {
    setError("");
    const valor = Number(String(tasa).replace(",", "."));
    if (!Number.isFinite(valor) || valor < 0) {
      setError("Escribe una tasa válida");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha.trim())) {
      setError("La fecha debe tener el formato AAAA-MM-DD");
      return;
    }
    setGuardando(true);
    try {
      if (editando) {
        await actualizar({ id: editando._id, tasa: valor, fecha: fecha.trim(), nota: nota.trim() });
      } else {
        await crear({ tasa: valor, fecha: fecha.trim(), nota: nota.trim() });
      }
      setAbierto(false);
    } catch (e: any) {
      setError(e?.message || "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  const registros: any[] = lista || [];
  const esHoy = actual?.fecha === actual?.hoy;

  return (
    <PantallaAdmin titulo="Interés" subtitulo="Tasa de interés del día" activo="interes">
      <Card style={styles.destacado}>
        <Text style={styles.destacadoLabel}>Tasa vigente</Text>
        <Text style={styles.destacadoValor}>{fmt(actual?.tasa ?? 0)}%</Text>
        <Text style={styles.destacadoPie}>
          {esHoy ? "Registrada hoy" : `Última registrada: ${actual?.fecha || "sin registro"}`}
        </Text>
        <Text style={styles.destacadoEjemplo}>
          Ejemplo: un préstamo de 100 por {fmt(actual?.tasa ?? 0)}% paga {fmt(100 + (100 * (Number(actual?.tasa) || 0)) / 100)}
        </Text>
      </Card>

      <View style={styles.stats}>
        <View style={{ flex: 1 }}>
          <StatCard label="Préstamos que la usan" valor={String(actual?.prestamosQueLoUsan ?? 0)} sub="No pagados" color={COLORS.azul} />
        </View>
        <View style={{ flex: 1 }}>
          <StatCard label="Registros" valor={String(registros.length)} sub="Historial" color={COLORS.verde} />
        </View>
      </View>

      <Button title="Agregar tasa del día" onPress={abrirNuevo} />

      <SectionTitle>Historial de tasas</SectionTitle>
      {registros.length === 0 ? (
        <Empty mensaje="Aún no hay tasas registradas. Agrega la primera para que se aplique a los préstamos nuevos." />
      ) : null}
      {registros.map((r) => (
        <Card key={r._id}>
          <View style={styles.fila}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tasa}>{fmt(r.tasa)}%</Text>
              <Text style={styles.fecha}>
                {r.fecha}
                {r.fecha === hoy() ? " · hoy" : ""}
                {r._id === actual?.id ? " · vigente" : ""}
              </Text>
              {r.nota ? <Text style={styles.nota}>{r.nota}</Text> : null}
            </View>
            <View style={styles.acciones}>
              <Chip activo={false} label="Editar" onPress={() => abrirEdicion(r)} />
              <Chip activo={false} label="Eliminar" onPress={() => setABorrar(r)} />
            </View>
          </View>
        </Card>
      ))}

      <Card>
        <SectionTitle>Dónde se aplica</SectionTitle>
        <Row label="Préstamos nuevos" value="Tasa del día vigente" />
        <Row label="Préstamos ya creados" value="Conservan su tasa" />
        <Text style={styles.nota}>
          El porcentaje es el interés TOTAL del préstamo, no diario ni mensual: se aplica una sola vez
          sobre el capital y queda congelado en ese préstamo. Ej: 10% sobre 100 = 110 a pagar.
        </Text>
        <Text style={styles.nota}>
          Si no hay ninguna tasa registrada se usa la tasa por defecto de Ajustes.
        </Text>
      </Card>

      <ModalSheet visible={abierto} onClose={() => setAbierto(false)} title={editando ? "Modificar tasa" : "Agregar tasa del día"}>
        <Text style={styles.nota}>
          El % es el interés total del préstamo (10% sobre 100 = 110 a pagar). Quedará congelado en
          los préstamos que se creen hoy.
        </Text>
        <Input label="Tasa de interés %" value={tasa} onChangeText={setTasa} keyboardType="numeric" placeholder="Ej: 10" />
        <Input label="Fecha (AAAA-MM-DD)" value={fecha} onChangeText={setFecha} autoCapitalize="none" placeholder="2026-01-31" />
        <Input label="Nota (opcional)" value={nota} onChangeText={setNota} placeholder="Ej: subida por inflación" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Guardar" onPress={guardar} loading={guardando} />
        <View style={{ height: 8 }} />
        <Button title="Cancelar" variant="ghost" onPress={() => setAbierto(false)} />
      </ModalSheet>

      <Confirmar
        visible={!!aBorrar}
        titulo="Eliminar tasa"
        mensaje={`¿Eliminar la tasa de ${aBorrar?.fecha || ""}?`}
        peligro
        onCancel={() => setABorrar(null)}
        onConfirm={async () => {
          if (aBorrar) await eliminar({ id: aBorrar._id });
          setABorrar(null);
        }}
      />
    </PantallaAdmin>
  );
}

const styles = StyleSheet.create({
  destacado: { alignItems: "center", paddingVertical: 22, backgroundColor: COLORS.azul, borderColor: COLORS.azul },
  destacadoLabel: { color: COLORS.azulClaro, fontSize: 13, fontWeight: "700", letterSpacing: 0.5 },
  destacadoValor: { color: COLORS.blanco, fontSize: 44, fontWeight: "900", marginVertical: 4 },
  destacadoPie: { color: COLORS.azulClaro, fontSize: 12 },
  destacadoEjemplo: { color: COLORS.azulClaro, fontSize: 12, marginTop: 8, textAlign: "center" },
  stats: { flexDirection: "row", gap: 10, marginBottom: 14 },
  fila: { flexDirection: "row", alignItems: "center", gap: 8 },
  tasa: { fontSize: 22, fontWeight: "800", color: COLORS.texto },
  fecha: { color: COLORS.textoSuave, fontSize: 12, marginTop: 2 },
  nota: { color: COLORS.textoSuave, fontSize: 12, marginTop: 6, lineHeight: 16 },
  acciones: { gap: 6 },
  error: { color: COLORS.rojo, marginBottom: 10, fontWeight: "600" },
});

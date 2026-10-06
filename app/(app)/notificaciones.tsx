import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useMutation, useQuery } from "../../lib/api";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { api } from "../../lib/api";
import { Screen, Card, Button, COLORS, Empty, Confirmar } from "../../lib/ui";

export default function Notificaciones() {
  const lista = useQuery(api.notificaciones.list);
  const marcarLeida = useMutation(api.notificaciones.marcarLeida);
  const leerTodas = useMutation(api.notificaciones.leerTodas);
  const eliminar = useMutation(api.notificaciones.eliminar);
  const vaciar = useMutation(api.notificaciones.vaciar);
  const [confirmarVaciar, setConfirmarVaciar] = useState(false);

  if (!lista) return null;

  return (
    <Screen>
      <View style={styles.head}>
        <Text style={styles.titulo}>Notificaciones</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button small variant="secondary" title="Leer todas" onPress={() => leerTodas()} />
          <Button small variant="danger" title="Vaciar" onPress={() => setConfirmarVaciar(true)} />
        </View>
      </View>

      {lista.length === 0 && <Empty mensaje="No hay notificaciones" />}

      {lista.map((n: any) => (
        <Card key={n._id} style={[styles.card, !n.leida && styles.cardNoLeida]}>
          <View style={styles.row}>
            <Pressable style={{ flex: 1 }} onPress={() => marcarLeida({ id: n._id })}>
              <Text style={[styles.msg, !n.leida && { fontWeight: "700" }]}>{n.mensaje}</Text>
              <Text style={styles.fecha}>{n.fecha}</Text>
            </Pressable>
            {!n.leida ? (
              <Pressable onPress={() => marcarLeida({ id: n._id })} style={{ marginHorizontal: 6 }}>
                <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.verde} />
              </Pressable>
            ) : null}
            <Pressable onPress={() => eliminar({ id: n._id })}>
              <Ionicons name="trash-outline" size={20} color={COLORS.rojo} />
            </Pressable>
          </View>
        </Card>
      ))}

      <Button title="Cerrar" variant="ghost" onPress={() => router.back()} />

      <Confirmar
        visible={confirmarVaciar}
        titulo="¿Vaciar todas las notificaciones?"
        onCancel={() => setConfirmarVaciar(false)}
        onConfirm={() => {
          vaciar();
          setConfirmarVaciar(false);
        }}
        peligro
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  titulo: { fontSize: 20, fontWeight: "900", color: COLORS.texto },
  card: { marginBottom: 8 },
  cardNoLeida: { borderColor: COLORS.azul, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center" },
  msg: { color: COLORS.texto, fontSize: 14, marginBottom: 4 },
  fecha: { color: COLORS.gris, fontSize: 12 },
});
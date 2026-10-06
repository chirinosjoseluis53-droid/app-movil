import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useMutation, useQuery, api } from "../lib/api";
import { router } from "expo-router";
import { Screen, Input, Button, COLORS, Card } from "../lib/ui";

export default function Registro() {
  const registrar = useMutation(api.auth.registroUsuario);

  const [usuario, setUsuario] = useState("");
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [esperando, setEsperando] = useState(false);

  const usuarioLimpio = usuario.trim();
  const correoLimpio = correo.trim().toLowerCase();

  // Verifica en la base si el usuario y el correo ya existen.
  const disp = useQuery(
    api.auth.disponibilidad,
    usuarioLimpio.length >= 3 || correoLimpio.includes("@")
      ? { username: usuarioLimpio, email: correoLimpio }
      : "skip"
  );

  const correoDuplicado = !!disp && correoLimpio.includes("@") && !disp.correoLibre;
  const usuarioDuplicado = !!disp && usuarioLimpio.length >= 3 && !disp.usuarioLibre;

  async function enviar() {
    setError("");
    if (usuarioLimpio.length < 3) return setError("El usuario debe tener al menos 3 caracteres");
    if (!correoLimpio) return setError("Escribe tu correo");
    if (password.length < 4) return setError("La contraseña debe tener al menos 4 caracteres");
    if (password !== password2) return setError("Las contraseñas no coinciden");
    if (usuarioDuplicado) return setError("Ese nombre de usuario ya está registrado. Elige otro.");
    if (correoDuplicado) return setError("Ese correo ya está registrado. Usa otro correo.");

    setEsperando(true);
    try {
      await registrar({ username: usuarioLimpio, password, email: correoLimpio });
      router.replace("/login");
    } catch (e: any) {
      setError(e?.message || "Ocurrió un error al crear tu cuenta");
    } finally {
      setEsperando(false);
    }
  }

  return (
    <Screen scroll>
      <View style={{ height: 90 }} />
      <Text style={styles.titulo}>Crear cuenta</Text>
      <Text style={styles.sub}>
        Regístrate con tu usuario, contraseña y correo. Después de iniciar sesión
        completarás tu perfil en 5 pasos.
      </Text>

      <Card>
        <Input
          label="Usuario"
          value={usuario}
          onChangeText={setUsuario}
          placeholder="Ej: juanperez"
          autoCapitalize="none"
        />
        {usuarioDuplicado ? (
          <Text style={styles.error}>Ese usuario ya existe. Usa otro.</Text>
        ) : null}

        <Input
          label="Correo"
          value={correo}
          onChangeText={setCorreo}
          placeholder="tucorreo@ejemplo.com"
          keyboardType="email-address"
          autoCapitalize="none"
          style={{ marginTop: 12 }}
        />
        {correoDuplicado ? (
          <Text style={styles.error}>Ese correo ya está registrado. Usa otro.</Text>
        ) : null}

        <Input
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          placeholder="Mínimo 4 caracteres"
          secureTextEntry
          style={{ marginTop: 12 }}
        />
        <Input
          label="Repetir contraseña"
          value={password2}
          onChangeText={setPassword2}
          placeholder="Repite tu contraseña"
          secureTextEntry
          style={{ marginTop: 12 }}
        />
      </Card>

      {error ? <Text style={[styles.error, { marginTop: 12 }]}>{error}</Text> : null}

      <Button
        title="Crear cuenta"
        onPress={enviar}
        loading={esperando}
        disabled={usuarioDuplicado || correoDuplicado}
        style={{ marginTop: 16 }}
      />
      <View style={{ height: 10 }} />
      <Button
        title="Ya tengo cuenta · Iniciar sesión"
        variant="ghost"
        onPress={() => router.replace("/login")}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titulo: { fontSize: 26, fontWeight: "900", color: COLORS.azul, textAlign: "center" },
  sub: {
    fontSize: 13,
    color: COLORS.textoSuave,
    textAlign: "center",
    marginBottom: 20,
    marginTop: 4,
  },
  error: { color: COLORS.rojo, fontSize: 13, marginTop: 6, fontWeight: "600" },
});

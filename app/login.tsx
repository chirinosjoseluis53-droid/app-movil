import React, { useState } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, TextInput } from "react-native";
import { useMutation } from "../lib/api";
import { Redirect, router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as LocalAuthentication from "expo-local-authentication";
import { api } from "../lib/api";
import { COLORS } from "../lib/ui";
import { useSesion } from "../lib/sesion";
import { guardarCredenciales, leerCredenciales, borrarCredenciales } from "../lib/credenciales";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const loginSchema = z.object({
  username: z.string().min(1, "Ingresa tu usuario o correo"),
  password: z.string().min(4, "La contraseña debe tener al menos 4 caracteres"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const { sesion, cargando, iniciarAdmin, iniciarCliente } = useSesion();
  const loginAdmin = useMutation(api.auth.login);
  
  const { control, handleSubmit, setValue, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    }
  });

  const [errorGlobal, setErrorGlobal] = useState("");
  const [esperando, setEsperando] = useState(false);
  const [verPassword, setVerPassword] = useState(false);
  
  React.useEffect(() => {
    verificarBiometrico();
  }, []);

  async function verificarBiometrico() {
    const hasBiometrics = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasBiometrics || !isEnrolled) return;

    const savedCreds = await leerCredenciales();
    if (savedCreds) {
      entrarBiometrico(savedCreds);
    }
  }

  async function entrarBiometrico(creds: { user: string, pass: string }) {
    const auth = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Iniciar sesión con Biometría',
      fallbackLabel: 'Usar contraseña'
    });
    if (auth.success) {
      setValue("username", creds.user);
      setValue("password", creds.pass);
      ejecutarLogin(creds.user, creds.pass);
    }
  }

  const onSubmit = async (data: LoginFormData) => {
    ejecutarLogin(data.username, data.password);
  };

  async function ejecutarLogin(usr: string, pwd: string) {
    setErrorGlobal("");
    setEsperando(true);
    try {
      const r = await loginAdmin({ username: usr.trim(), password: pwd });
      await guardarCredenciales(usr, pwd);
      if (r.rol === "admin") {
        await iniciarAdmin(r.username, r.userId);
        router.replace("/(app)/(tabs)");
        return;
      }
      if (!r.clienteId) {
        await iniciarCliente({
          clienteId: "",
          nombre: r.nombre || r.username,
          userId: r.userId,
          username: r.username,
          email: r.email || "",
          perfilCompleto: false,
        });
        router.replace("/bienvenida-cliente");
        return;
      }
      await iniciarCliente({
        clienteId: r.clienteId,
        nombre: r.nombre,
        userId: r.userId,
        username: r.username,
        email: r.email || "",
        perfilCompleto: r.perfilCompleto,
      });
      router.replace(r.perfilCompleto ? "/cliente" : "/bienvenida-cliente");
    } catch (e: any) {
      await borrarCredenciales();
      setErrorGlobal(e?.message || "Credenciales incorrectas");
    } finally {
      setEsperando(false);
    }
  }

  if (cargando) return null;
  if (sesion?.rol === "admin") return <Redirect href="/(app)/(tabs)" />;
  if (sesion?.rol === "cliente") return <Redirect href="/cliente" />;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <View style={styles.logoInnerBox}>
              <Text style={styles.logoText}>$</Text>
            </View>
          </View>
          <Text style={styles.headerTitle}>Préstamo Fácil</Text>
          <Text style={styles.headerSub}>Inicia sesión en tu cuenta</Text>
        </View>

        <View style={styles.form}>
          
          <Text style={styles.label}>Usuario o correo</Text>
          <Controller
            control={control}
            name="username"
            render={({ field: { onChange, value } }) => (
              <View style={[styles.inputContainer, errors.username && styles.inputError]}>
                <Ionicons name="mail-outline" size={20} color={COLORS.textoSuave} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ingresa tu usuario"
                  placeholderTextColor={COLORS.textoSuave}
                  value={value}
                  onChangeText={onChange}
                  autoCapitalize="none"
                />
              </View>
            )}
          />
          {errors.username && <Text style={styles.errorText}>{errors.username.message}</Text>}

          <Text style={styles.label}>Contraseña</Text>
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, value } }) => (
              <View style={[styles.inputContainer, errors.password && styles.inputError]}>
                <Ionicons name="lock-closed-outline" size={20} color={COLORS.textoSuave} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ingresa tu contraseña"
                  placeholderTextColor={COLORS.textoSuave}
                  value={value}
                  onChangeText={onChange}
                  secureTextEntry={!verPassword}
                />
                <TouchableOpacity onPress={() => setVerPassword(!verPassword)} style={styles.eyeIcon}>
                  <Ionicons name={verPassword ? "eye-outline" : "eye-off-outline"} size={20} color={COLORS.textoSuave} />
                </TouchableOpacity>
              </View>
            )}
          />
          {errors.password && <Text style={styles.errorText}>{errors.password.message}</Text>}

          <TouchableOpacity style={styles.forgotBtn}>
            <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          {errorGlobal ? <Text style={styles.errorGlobal}>{errorGlobal}</Text> : null}

          <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit(onSubmit)} disabled={esperando}>
            <Text style={styles.primaryButtonText}>{esperando ? "Iniciando..." : "Iniciar sesión"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bioButton} onPress={verificarBiometrico}>
            <Ionicons name="finger-print-outline" size={24} color={COLORS.azul} style={{ marginRight: 8 }} />
            <Text style={styles.bioButtonText}>Usar Huella o Face ID</Text>
          </TouchableOpacity>

          <View style={styles.dividerBox}>
            <View style={styles.line} />
            <Text style={styles.orText}>o</Text>
            <View style={styles.line} />
          </View>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace("/registro")}>
            <Ionicons name="person-add-outline" size={18} color={COLORS.teal} style={{ marginRight: 8 }} />
            <Text style={styles.secondaryButtonText}>Crear cuenta</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.waveContainer}>
          <View style={styles.wave1} />
          <View style={styles.wave2} />
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.blanco },
  scroll: { flexGrow: 1, paddingBottom: 40, alignItems: 'center' },
  header: { marginTop: 80, alignItems: 'center', marginBottom: 40 },
  logoBox: { width: 72, height: 72, backgroundColor: COLORS.azul, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  logoInnerBox: { width: 32, height: 40, backgroundColor: COLORS.teal, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.blanco },
  logoText: { color: COLORS.blanco, fontWeight: '900', fontSize: 18 },
  headerTitle: { color: COLORS.azul, fontSize: 28, fontWeight: '900', marginBottom: 8 },
  headerSub: { color: COLORS.textoSuave, fontSize: 14 },
  form: { width: '100%', paddingHorizontal: 24, zIndex: 10 },
  label: { color: COLORS.texto, fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.borde, borderRadius: 12, backgroundColor: COLORS.blanco, marginBottom: 12, height: 52 },
  inputError: { borderColor: COLORS.rojo, backgroundColor: COLORS.rojoClaro },
  inputIcon: { paddingHorizontal: 16 },
  input: { flex: 1, height: '100%', fontSize: 15, color: COLORS.texto },
  eyeIcon: { paddingHorizontal: 16 },
  errorText: { color: COLORS.rojo, fontSize: 12, marginBottom: 12, marginLeft: 4 },
  errorGlobal: { color: COLORS.rojo, fontSize: 13, marginBottom: 12, textAlign: 'center', fontWeight: '500' },
  forgotBtn: { alignSelf: 'flex-start', marginBottom: 24, marginLeft: 4, marginTop: 8 },
  forgotText: { color: COLORS.teal, fontSize: 13, fontWeight: '600' },
  primaryButton: { backgroundColor: COLORS.azul, height: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 20, shadowColor: COLORS.azul, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  primaryButtonText: { color: COLORS.blanco, fontSize: 16, fontWeight: '700' },
  bioButton: { flexDirection: 'row', height: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 20, backgroundColor: '#F1F5F9' },
  bioButtonText: { color: COLORS.azul, fontSize: 15, fontWeight: '700' },
  dividerBox: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  line: { flex: 1, height: 1, backgroundColor: COLORS.borde },
  orText: { color: COLORS.textoSuave, paddingHorizontal: 12, fontSize: 13 },
  secondaryButton: { flexDirection: 'row', borderWidth: 1, borderColor: COLORS.teal, height: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: COLORS.teal, fontSize: 16, fontWeight: '700' },
  waveContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, overflow: 'hidden', zIndex: 1 },
  wave1: { position: 'absolute', bottom: -60, left: -50, width: 600, height: 140, backgroundColor: COLORS.tealClaro, borderRadius: 300, transform: [{ scaleX: 1.5 }], opacity: 0.6 },
  wave2: { position: 'absolute', bottom: -80, left: -100, width: 600, height: 140, backgroundColor: COLORS.teal, borderRadius: 300, transform: [{ scaleX: 1.5 }], opacity: 0.3 }
});
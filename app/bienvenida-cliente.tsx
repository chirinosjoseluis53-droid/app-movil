import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Redirect, router } from "expo-router";
import MapView, { Marker, type MapPressEvent, type Region } from "react-native-maps";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { api, useMutation, useQuery } from "../lib/api";
import { useSesion } from "../lib/sesion";
import { persistLocalImage } from "../lib/media";
import { Screen, Input, Button, Card, COLORS } from "../lib/ui";

// Caracas por si el usuario no da permiso de ubicación
const REGION_INICIAL: Region = {
  latitude: 10.4806,
  longitude: -66.9036,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const TOTAL = 5;

const PASOS = [
  { titulo: "1 · Tu nombre completo", sub: "Escribe tu nombre y tu apellido." },
  { titulo: "2 · Tu cédula", sub: "Ingresa el número de tu cédula." },
  { titulo: "3 · Tu teléfono", sub: "Un número donde te podamos contactar." },
  { titulo: "4 · Tu dirección", sub: "Escribe tu dirección y marca el punto en el mapa." },
  { titulo: "5 · Tus fotos", sub: "Foto de tu cédula (ambos lados) y una foto de perfil." },
];

type Form = {
  nombre: string;
  apellido: string;
  cedula: string;
  telefono: string;
  ubicacion: string;
  lat: number | null;
  lng: number | null;
  fotoFront: string | null;
  fotoBack: string | null;
  fotoPerfil: string | null;
};

const VACIO: Form = {
  nombre: "",
  apellido: "",
  cedula: "",
  telefono: "",
  ubicacion: "",
  lat: null,
  lng: null,
  fotoFront: null,
  fotoBack: null,
  fotoPerfil: null,
};

export default function BienvenidaCliente() {
  const { sesion, cargando, actualizarCliente } = useSesion();
  const [paso, setPaso] = useState(0);
  const [f, setF] = useState<Form>(VACIO);
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);
  const [esperando, setEsperando] = useState(false);
  const [gps, setGps] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const mapRef = useRef<MapView>(null);

  const userId = sesion?.rol === "cliente" ? sesion.userId : null;
  const guardado = useMutation(api.portalCliente.guardarPerfil);
  const datos = useQuery(api.portalCliente.perfil, userId ? { userId } : "skip");

  // Precarga lo ya guardado
  useEffect(() => {
    if (!datos?.perfil) return;
    setF((prev) => ({
      ...prev,
      nombre: datos.perfil.nombre || prev.nombre,
      apellido: datos.perfil.apellido || prev.apellido,
      cedula: datos.perfil.cedula || prev.cedula,
      telefono: datos.perfil.telefono || prev.telefono,
      ubicacion: datos.perfil.ubicacion || prev.ubicacion,
      lat: datos.perfil.lat ?? prev.lat,
      lng: datos.perfil.lng ?? prev.lng,
      fotoFront: datos.perfil.fotoFront || prev.fotoFront,
      fotoBack: datos.perfil.fotoBack || prev.fotoBack,
      fotoPerfil: datos.perfil.fotoPerfil || prev.fotoPerfil,
    }));
  }, [datos]);

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  async function elegirFoto(campo: "fotoFront" | "fotoBack" | "fotoPerfil") {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      setError("Necesitas permitir el acceso a las fotos");
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.6,
    });
    if (!r.canceled && r.assets.length) set(campo, r.assets[0].uri);
  }

  // Escribe la dirección y la busca en el mapa.
  async function buscarDireccion() {
    const texto = f.ubicacion.trim();
    setError("");
    if (!texto) return setError("Escribe tu dirección");
    setBuscando(true);
    try {
      const resultados = await Location.geocodeAsync(texto);
      if (!resultados.length) {
        setError("No encontramos esa dirección. Escríbela con más detalle o toca el mapa.");
        return;
      }
      const r = resultados[0];
      setF((prev) => ({ ...prev, lat: r.latitude, lng: r.longitude }));
      mapRef.current?.animateToRegion(
        { latitude: r.latitude, longitude: r.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        600
      );
    } catch (e: any) {
      setError("No pudimos buscar esa dirección. Toca el mapa para marcar el punto.");
    } finally {
      setBuscando(false);
    }
  }

  // Al tocar el mapa, completa el texto de la dirección con la calle del punto.
  async function llenarDireccion(lat: number, lng: number) {
    try {
      const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const p = places[0];
      if (!p) return;
      const texto = [p.street, p.streetNumber, p.district, p.city, p.region]
        .filter(Boolean)
        .join(", ");
      if (texto) setF((prev) => ({ ...prev, ubicacion: texto }));
    } catch {
      // si el sistema no puede, el usuario escribe la dirección
    }
  }

  async function usarMiUbicacion() {
    setError("");
    setGps(true);
    try {
      const permiso = await Location.requestForegroundPermissionsAsync();
      if (!permiso.granted) {
        setError("Necesitas permiso de ubicación para marcar tu dirección");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setF((prev) => ({
        ...prev,
        lat,
        lng,
        ubicacion: prev.ubicacion || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      }));
      if (!f.ubicacion.trim()) await llenarDireccion(lat, lng);
      mapRef.current?.animateToRegion(
        { latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        600
      );
    } catch (e: any) {
      setError("No pudimos obtener tu ubicación. Toca el mapa para marcar el punto.");
    } finally {
      setGps(false);
    }
  }

  function validarPaso(actual: number): string {
    if (actual === 0) {
      if (!f.nombre.trim()) return "Escribe tu nombre";
      if (!f.apellido.trim()) return "Escribe tu apellido";
    }
    if (actual === 1) {
      if (!f.cedula.trim()) return "Ingresa tu número de cédula";
      if (f.cedula.trim().replace(/\s/g, "").length < 5) return "El número de cédula es muy corto";
    }
    if (actual === 2) {
      const tel = f.telefono.replace(/[\s\-()]/g, "");
      if (!tel) return "Ingresa tu teléfono";
      if (tel.length < 7) return "El teléfono es muy corto";
    }
    if (actual === 3) {
      if (!f.ubicacion.trim()) return "Escribe tu dirección";
      if (f.lat == null || f.lng == null) return "Toca el mapa para marcar tu ubicación";
    }
    if (actual === 4) {
      if (!f.fotoFront) return "Sube la foto frontal de tu cédula";
      if (!f.fotoBack) return "Sube la foto posterior de tu cédula";
      if (!f.fotoPerfil) return "Sube tu foto de perfil";
    }
    return "";
  }

  // Guarda el avance de cada paso (queda pendiente hasta completar los 5).
  async function persistir(completar: boolean) {
    if (!userId) throw new Error("Sesión inválida");
    const [frontal, posterior, perfil] = await Promise.all([
      f.fotoFront ? persistLocalImage(f.fotoFront, "cedula") : Promise.resolve(""),
      f.fotoBack ? persistLocalImage(f.fotoBack, "cedula") : Promise.resolve(""),
      f.fotoPerfil ? persistLocalImage(f.fotoPerfil, "perfil") : Promise.resolve(""),
    ]);
    setF((prev) => ({
      ...prev,
      fotoFront: frontal || prev.fotoFront,
      fotoBack: posterior || prev.fotoBack,
      fotoPerfil: perfil || prev.fotoPerfil,
    }));
    return guardado({
      userId,
      nombre: f.nombre,
      apellido: f.apellido,
      cedula: f.cedula,
      telefono: f.telefono,
      ubicacion: f.ubicacion,
      lat: f.lat,
      lng: f.lng,
      fotoFront: frontal,
      fotoBack: posterior,
      fotoPerfil: perfil,
      completar,
    });
  }

  async function siguiente() {
    setError("");
    const err = validarPaso(paso);
    if (err) return setError(err);

    if (paso < TOTAL - 1) {
      setEsperando(true);
      try {
        await persistir(false);
        setPaso(paso + 1);
      } catch (e: any) {
        setError(e?.message || "No pudimos guardar tus datos");
      } finally {
        setEsperando(false);
      }
      return;
    }

    setEsperando(true);
    try {
      const r = await persistir(true);
      await actualizarCliente({
        clienteId: r.solicitudId,
        nombre: `${f.nombre.trim()} ${f.apellido.trim()}`.trim(),
        perfilCompleto: true,
      });
      setListo(true);
    } catch (e: any) {
      setError(e?.message || "No pudimos guardar tu perfil");
      setEsperando(false);
    }
  }

  function atras() {
    setError("");
    setPaso((p) => Math.max(0, p - 1));
  }

  if (cargando) return null;
  if (!sesion || sesion.rol !== "cliente") return <Redirect href="/login" />;

  if (listo) {
    return (
      <Screen pad>
        <View style={styles.centro}>
          <Text style={styles.grande}>✅</Text>
          <Text style={styles.titulo}>¡Perfil completado!</Text>
          <Text style={styles.sub}>
            Gracias {sesion.nombre}. Ya puedes ver tus préstamos, pagar y solicitar
            crédito. El administrador ya tiene tus datos y tu ubicación.
          </Text>
          <Button title="Ir a mi inicio" onPress={() => router.replace("/cliente")} style={{ marginTop: 20, width: "100%" }} />
        </View>
      </Screen>
    );
  }

  const region: Region = f.lat != null && f.lng != null
    ? { latitude: f.lat, longitude: f.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }
    : REGION_INICIAL;

  return (
    <Screen scroll>
      <View style={{ height: 40 }} />
      <View style={styles.cabecera}>
        <Text style={styles.titulo}>{PASOS[paso].titulo}</Text>
        <Text style={styles.sub}>{PASOS[paso].sub}</Text>
      </View>

      <View style={styles.puntos}>
        {PASOS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.punto,
              i < paso && styles.puntoHecho,
              i === paso && styles.puntoActivo,
            ]}
          />
        ))}
      </View>

      {paso === 0 ? (
        <Card>
          <Input label="Nombre" value={f.nombre} onChangeText={(t) => set("nombre", t)} placeholder="Tu nombre" />
          <Input
            label="Apellido"
            value={f.apellido}
            onChangeText={(t) => set("apellido", t)}
            placeholder="Tu apellido"
            style={{ marginTop: 12 }}
          />
        </Card>
      ) : null}

      {paso === 1 ? (
        <Card>
          <Input
            label="Número de cédula"
            value={f.cedula}
            onChangeText={(t) => set("cedula", t)}
            placeholder="V-12345678"
            keyboardType="default"
          />
          <Text style={styles.nota}>Ejemplo: V-12345678</Text>
        </Card>
      ) : null}

      {paso === 2 ? (
        <Card>
          <Input
            label="Teléfono"
            value={f.telefono}
            onChangeText={(t) => set("telefono", t)}
            placeholder="04141234567"
            keyboardType="phone-pad"
          />
          <Text style={styles.nota}>Lo usaremos para avisarte sobre tus pagos.</Text>
        </Card>
      ) : null}

      {paso === 3 ? (
        <View>
          <Input
            label="Escribe tu dirección"
            value={f.ubicacion}
            onChangeText={(t) => set("ubicacion", t)}
            placeholder="Ej: Av. Principal, casa #4, Caracas"
            multiline
          />
          <Button
            title={buscando ? "Buscando..." : "🔎 Ver en el mapa"}
            onPress={buscarDireccion}
            loading={buscando}
            disabled={!f.ubicacion.trim() || buscando}
            style={{ marginTop: 10 }}
          />

          <View style={styles.mapaBox}>
            <MapView
              ref={mapRef}
              style={styles.mapa}
              region={region}
              onPress={(e: MapPressEvent) => {
                const c = e?.nativeEvent?.coordinate;
                if (!c) return;
                setF((prev) => ({ ...prev, lat: c.latitude, lng: c.longitude }));
                llenarDireccion(c.latitude, c.longitude);
              }}
            >
              {f.lat != null && f.lng != null ? (
                <Marker coordinate={{ latitude: f.lat, longitude: f.lng }} />
              ) : null}
            </MapView>
          </View>

          <Text style={styles.nota}>
            {f.lat != null && f.lng != null
              ? `📍 Marcado en ${f.lat.toFixed(5)}, ${f.lng.toFixed(5)}. Escribe otra dirección o toca el mapa para mover el marcador.`
              : "Escribe tu dirección y presiona «Ver en el mapa», o toca el mapa para colocar el marcador 📌"}
          </Text>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <Button
              title={gps ? "Ubicando..." : "📍 Usar mi ubicación"}
              variant="secondary"
              onPress={usarMiUbicacion}
              loading={gps}
              style={{ flex: 1 }}
            />
            {f.lat != null && f.lng != null ? (
              <Button
                title="Ver en Maps"
                variant="ghost"
                onPress={() =>
                  Linking.openURL(
                    `https://www.google.com/maps/search/?api=1&query=${f.lat},${f.lng}`
                  ).catch(() => {})
                }
              />
            ) : null}
          </View>
        </View>
      ) : null}

      {paso === 4 ? (
        <View>
          <Text style={styles.rotulo}>Foto de perfil *</Text>
          <TouchableOpacity style={styles.fotoCaja} onPress={() => elegirFoto("fotoPerfil")}>
            {f.fotoPerfil ? (
              <Image source={{ uri: f.fotoPerfil }} style={styles.foto} />
            ) : (
              <Text style={styles.fotoTexto}>+ Subir foto de perfil</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.rotulo}>Foto de tu cédula *</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity style={styles.fotoCaja} onPress={() => elegirFoto("fotoFront")}>
              {f.fotoFront ? (
                <Image source={{ uri: f.fotoFront }} style={styles.foto} />
              ) : (
                <Text style={styles.fotoTexto}>+ Frontal</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.fotoCaja} onPress={() => elegirFoto("fotoBack")}>
              {f.fotoBack ? (
                <Image source={{ uri: f.fotoBack }} style={styles.foto} />
              ) : (
                <Text style={styles.fotoTexto}>+ Posterior</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
        {paso > 0 ? <Button title="Atrás" variant="ghost" onPress={atras} style={{ flex: 1 }} /> : null}
        <Button
          title={paso === TOTAL - 1 ? "Guardar perfil" : "Siguiente"}
          onPress={siguiente}
          loading={esperando}
          style={{ flex: 2 }}
        />
      </View>

      {esperando ? (
        <View style={{ marginTop: 14, alignItems: "center" }}>
          <ActivityIndicator color={COLORS.teal} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cabecera: { marginTop: 10, marginBottom: 14 },
  titulo: { fontSize: 22, fontWeight: "900", color: COLORS.azul },
  sub: { fontSize: 13, color: COLORS.textoSuave, marginTop: 4 },
  grande: { fontSize: 60, textAlign: "center" },
  centro: { marginTop: 60, alignItems: "center" },
  puntos: { flexDirection: "row", gap: 6, marginBottom: 18 },
  punto: { flex: 1, height: 6, borderRadius: 50, backgroundColor: COLORS.grisClaro },
  puntoHecho: { backgroundColor: COLORS.verde },
  puntoActivo: { backgroundColor: COLORS.azul },
  nota: { fontSize: 12, color: COLORS.textoSuave, marginTop: 8 },
  rotulo: { fontSize: 13, fontWeight: "700", color: COLORS.textoSuave, marginTop: 14, marginBottom: 8 },
  mapaBox: {
    height: 260,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: COLORS.borde,
    marginTop: 12,
  },
  mapa: { width: "100%", height: "100%" },
  fotoCaja: {
    height: 150,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.azul2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: COLORS.blanco,
  },
  foto: { width: "100%", height: "100%" },
  fotoTexto: { color: COLORS.azul2, fontWeight: "700" },
  error: { color: COLORS.rojo, fontSize: 13, marginTop: 12, fontWeight: "600" },
});

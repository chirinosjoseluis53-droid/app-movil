import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Image, Linking, TouchableOpacity } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { useMutation, useQuery } from "../../../lib/api";
import { api } from "../../../lib/api";
import {
  Card, Row, SectionTitle, Button, Input, SearchBar, Badge, Chip,
  Empty, Fab, ModalSheet, Confirmar, COLORS, fmt,
} from "../../../lib/ui";
import { PantallaAdmin } from "../../../lib/pantalla-admin";
import type { Id } from "../../../lib/api";

const urlMapa = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
const urlRuta = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

export default function Clientes() {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<"aprobado" | "pendiente" | "rechazado">("aprobado");
  const [limite, setLimite] = useState(20);
  const pagina = useQuery(api.clientes.page, { q: q || undefined, estado, limite });

  const [modalNuevo, setModalNuevo] = useState(false);
  const [detalle, setDetalle] = useState<Id<"solicitudes"> | null>(null);
  const cuenta = useQuery(api.clientes.estadoCuenta, detalle ? { id: detalle } : "skip");
  const [confBloqueo, setConfBloqueo] = useState<any>(null);

  const create = useMutation(api.clientes.create);
  const toggleBloqueo = useMutation(api.clientes.toggleBloqueo);

  const [form, setForm] = useState<any>({});
  const [er, setEr] = useState("");
  const [modalEstrellas, setModalEstrellas] = useState(false);
  const [nuevasEstrellas, setNuevasEstrellas] = useState("");
  const actualizarEstrellas = useMutation(api.clientes2.actualizarEstrellas);
  const estrellasQuery: any = useQuery(
    api.clientes2.getEstrellas,
    detalle ? { clienteId: detalle } : "skip"
  );

  // Al cambiar la búsqueda o el filtro se vuelve a la primera página.
  React.useEffect(() => {
    setLimite(20);
  }, [q, estado]);

  const visibles = pagina?.items || [];

  async function guardarNuevo() {
    setEr("");
    try {
      await create({
        nombre: form.nombre,
        apellido: form.apellido,
        cedula: form.cedula,
        edad: form.edad ? Number(form.edad) : undefined,
        telefono: form.telefono || undefined,
        ubicacion: form.ubicacion || undefined,
        correo: form.correo || undefined,
        notas: form.notas || undefined,
      });
      setModalNuevo(false);
      setForm({});
    } catch (e: any) {
      setEr(e?.message || "Error");
    }
  }

  const abrir = (url: string) => Linking.openURL(url).catch(() => {});

  const cl = cuenta?.cliente;
  const region: Region | null =
    cl && cl.lat != null && cl.lng != null
      ? { latitude: cl.lat, longitude: cl.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }
      : null;

  return (
    <PantallaAdmin titulo="Clientes" activo="clientes">

      <SearchBar value={q} onChange={setQ} />
      <View style={styles.chips}>
        <Chip activo={estado === "aprobado"} label="Clientes" onPress={() => setEstado("aprobado")} />
        <Chip activo={estado === "pendiente"} label="Perfil incompleto" onPress={() => setEstado("pendiente")} />
        <Chip activo={estado === "rechazado"} label="Rechazados" onPress={() => setEstado("rechazado")} />
      </View>

      {visibles.length === 0 && <Empty mensaje="No hay clientes" />}
      {visibles.map((c: any) => (
        <Pressable key={c._id} onPress={() => setDetalle(c._id)}>
          <Card style={styles.card}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {c.fotoPerfil ? (
                <Image source={{ uri: c.fotoPerfil }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarVacio]}>
                  <Text style={styles.inicial}>{(c.nombre || "?").charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.nombre}>
                  {c.nombre} {c.apellido}
                </Text>
                <Text style={styles.sub}>{c.cedula}</Text>
              </View>
              {c.bloqueado ? (
                <Badge estado="bloqueado" />
              ) : estado === "pendiente" ? (
                <Badge estado="pendiente" />
              ) : (
                <Badge estado="aprobado" />
              )}
            </View>
            <Row label="Teléfono" value={c.telefono || "—"} />
            <Row label="Dirección" value={c.ubicacion || "—"} />
            {c.lat != null && c.lng != null ? (
              <Row
                label="Ubicación"
                value={
                  <Text
                    style={styles.link}
                    onPress={() => abrir(urlRuta(c.lat, c.lng))}
                  >
                    📍 Cómo llegar
                  </Text>
                }
              />
            ) : null}
            <Row label="Préstamos" value={`${c.n_prestamos ?? 0} · ${fmt(c.total_prestado ?? 0)}`} />
          </Card>
        </Pressable>
      ))}

      {pagina?.hayMas ? (
        <Button
          title={`Cargar más (${pagina.total} en total)`}
          variant="ghost"
          onPress={() => setLimite((l) => l + 20)}
        />
      ) : null}

      <Fab titulo="Cliente" onPress={() => setModalNuevo(true)} />

      {/* Registrar manual */}
      <ModalSheet visible={modalNuevo} onClose={() => setModalNuevo(false)} title="Registrar cliente">
        <Input label="Nombre *" value={form.nombre || ""} onChangeText={(t) => setForm({ ...form, nombre: t })} />
        <Input label="Apellido *" value={form.apellido || ""} onChangeText={(t) => setForm({ ...form, apellido: t })} />
        <Input label="Cédula *" value={form.cedula || ""} onChangeText={(t) => setForm({ ...form, cedula: t })} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Input label="Edad" value={form.edad || ""} onChangeText={(t) => setForm({ ...form, edad: t })} keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Teléfono" value={form.telefono || ""} onChangeText={(t) => setForm({ ...form, telefono: t })} keyboardType="phone-pad" />
          </View>
        </View>
        <Input label="Ubicación" value={form.ubicacion || ""} onChangeText={(t) => setForm({ ...form, ubicacion: t })} />
        <Input label="Correo" value={form.correo || ""} onChangeText={(t) => setForm({ ...form, correo: t })} keyboardType="email-address" />
        <Input label="Notas" value={form.notas || ""} onChangeText={(t) => setForm({ ...form, notas: t })} multiline />
        {er ? <Text style={{ color: COLORS.rojo, marginBottom: 8 }}>{er}</Text> : null}
        <Button title="Registrar" onPress={guardarNuevo} />
      </ModalSheet>

      {/* Estado de cuenta */}
      <ModalSheet visible={!!detalle} onClose={() => setDetalle(null)} title={cl ? `${cl.nombre} ${cl.apellido}` : "Cliente"}>
        {cuenta && cl && (
          <>
            <Card style={{ marginTop: 0 }}>
              {cl.fotoPerfil ? (
                <Image source={{ uri: cl.fotoPerfil }} style={styles.fotoPerfil} />
              ) : null}
              <Row label="Usuario" value={cl.username || "—"} />
              <Row label="Correo" value={cl.email || "—"} />
              <Row label="Cédula" value={cl.cedula || "—"} />
              <Row label="Teléfono" value={cl.telefono || "—"} />
              {cl.edad ? <Row label="Edad" value={String(cl.edad)} /> : null}
              <Row label="Registrado" value={cl.fecha_creacion || "—"} />
              <Row
                label="Perfil"
                value={cl.perfilCompleto ? "Completado" : "Incompleto"}
              />
            </Card>

            <Card>
              <Text style={styles.tituloSeccion}>Dirección</Text>
              <Row label="Dirección" value={cl.ubicacion || "—"} />
              {region ? (
                <>
                  <View style={styles.mapaBox}>
                    <MapView style={styles.mapa} region={region} scrollEnabled={false} zoomEnabled={false}>
                      <Marker coordinate={{ latitude: cl.lat, longitude: cl.lng }} title={cl.ubicacion || undefined} />
                    </MapView>
                  </View>
                  <Text style={styles.coords}>
                    {Number(cl.lat).toFixed(5)}, {Number(cl.lng).toFixed(5)}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                    <Button
                      title="🧭 Cómo llegar"
                      onPress={() => abrir(urlRuta(cl.lat, cl.lng))}
                      style={{ flex: 1 }}
                    />
                    <Button
                      title="Ver mapa"
                      variant="secondary"
                      onPress={() => abrir(urlMapa(cl.lat, cl.lng))}
                      style={{ flex: 1 }}
                    />
                  </View>
                </>
              ) : (
                <Text style={styles.sinMapa}>
                  Este cliente todavía no marcó su ubicación en el mapa.
                </Text>
              )}
            </Card>

            {(cl.fotoFront || cl.fotoBack) && (
              <Card>
                <Text style={styles.tituloSeccion}>Cédula</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {cl.fotoFront ? <Image source={{ uri: cl.fotoFront }} style={styles.fotoDoc} /> : null}
                  {cl.fotoBack ? <Image source={{ uri: cl.fotoBack }} style={styles.fotoDoc} /> : null}
                </View>
              </Card>
            )}

            <Card>
              <Text style={styles.tituloSeccion}>Resumen</Text>
              <Row label="Préstamos" value={String(cuenta.resumen.prestamos)} />
              <Row label="Total prestado" value={fmt(cuenta.resumen.total_prestado)} />
              <Row label="Total pagado" value={fmt(cuenta.resumen.total_pagado)} />
              <Row label="Mora total" value={fmt(cuenta.resumen.total_mora)} />
            </Card>

            {/* Estrellas del cliente */}
            <Card style={styles.estrellasCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={styles.tituloSeccion}>Nivel del cliente</Text>
                <View style={styles.estrellaBadge}>
                  <Text style={styles.estrellaBadgeTxt}>{estrellasQuery?.estrellas ?? 0} ⭐</Text>
                </View>
              </View>
              <View style={styles.estrellasRow}>
                {[1,2,3,4,5,6,7,8,9,10,11,12].map((n) => (
                  <Text key={n} style={[styles.estrellaItem, n <= (estrellasQuery?.estrellas ?? 0) && styles.estrellaItemActiva]}>★</Text>
                ))}
              </View>
              <TouchableOpacity
                style={styles.btnEstrellas}
                onPress={() => {
                  setNuevasEstrellas(String(estrellasQuery?.estrellas ?? 0));
                  setModalEstrellas(true);
                }}
              >
                <Text style={styles.btnEstrellasTxt}>Modificar estrellas</Text>
              </TouchableOpacity>
            </Card>

            {cuenta.prestamos.map((p: any) => (
              <View key={p._id} style={{ 
                marginBottom: 12, padding: 16, borderRadius: 16, 
                backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' 
              }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={{ fontWeight: "900", color: '#0F172A', fontSize: 18 }}>{p.moneda} {fmt(p.monto)}</Text>
                  <Badge estado={p.estadoCalc} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                  <View>
                    <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Saldo Deuda</Text>
                    <Text style={{ fontWeight: '800', color: '#34D399', fontSize: 16 }}>{p.moneda} {fmt(p.saldo)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Vencimiento</Text>
                    <Text style={{ fontWeight: '600', color: '#0F172A' }}>{p.fechaVencimiento || "—"}</Text>
                  </View>
                </View>
              </View>
            ))}

            <Button
              title={cuenta.bloqueado ? "Desbloquear cliente" : "Bloquear cliente"}
              variant={cuenta.bloqueado ? "secondary" : "danger"}
              onPress={() => setConfBloqueo(cuenta)}
            />
            <Button title="Cerrar" variant="ghost" onPress={() => setDetalle(null)} />
          </>
        )}
      </ModalSheet>

      {/* Modal estrellas */}
      <ModalSheet visible={modalEstrellas} onClose={() => setModalEstrellas(false)} title="Gestionar estrellas">
        {cl && (
          <>
            <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.texto, marginBottom: 4 }}>
              {cl.nombre} {cl.apellido}
            </Text>
            <Text style={{ color: COLORS.textoSuave, fontSize: 13, marginBottom: 16 }}>
              Las estrellas determinan las cuotas: 5⭐ = hasta 4 cuotas, 8⭐ = hasta 8 cuotas, 12⭐ = hasta 12 cuotas.
            </Text>
            <Input
              label="Número de estrellas"
              value={nuevasEstrellas}
              onChangeText={setNuevasEstrellas}
              keyboardType="numeric"
              placeholder="Ej: 5"
            />
            <View style={styles.estrellasRow}>
              {[1,2,3,4,5,6,7,8,9,10,11,12].map((n) => (
                <Text key={n} style={[styles.estrellaItem, n <= Number(nuevasEstrellas) && styles.estrellaItemActiva]}>★</Text>
              ))}
            </View>
            <Button
              title="Guardar"
              onPress={async () => {
                setModalEstrellas(false);
                await actualizarEstrellas({ clienteId: detalle as string, estrellas: Number(nuevasEstrellas) || 0 });
              }}
            />
          </>
        )}
      </ModalSheet>

      <Confirmar
        visible={!!confBloqueo}
        titulo={confBloqueo?.bloqueado ? "¿Desbloquear cliente?" : "¿Bloquear este cliente?"}
        mensaje="Un cliente bloqueado no puede recibir nuevos préstamos."
        onCancel={() => setConfBloqueo(null)}
        onConfirm={() => {
          if (confBloqueo) toggleBloqueo({ id: confBloqueo.cliente.id });
          setConfBloqueo(null);
        }}
        peligro
      />
    </PantallaAdmin>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  nombre: { fontSize: 16, fontWeight: "800", color: COLORS.texto },
  sub: { fontSize: 12, color: COLORS.textoSuave },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.tealClaro },
  avatarVacio: { alignItems: "center", justifyContent: "center" },
  inicial: { fontWeight: "900", color: COLORS.teal, fontSize: 16 },
  link: { color: COLORS.teal, fontWeight: "700" },
  tituloSeccion: { fontWeight: "800", color: COLORS.azul, marginBottom: 8 },
  mapaBox: {
    height: 190,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: COLORS.borde,
    marginTop: 8,
  },
  mapa: { width: "100%", height: "100%" },
  coords: { fontSize: 12, color: COLORS.textoSuave, marginTop: 6 },
  sinMapa: { fontSize: 13, color: COLORS.textoSuave },
  fotoPerfil: { width: 84, height: 84, borderRadius: 42, alignSelf: "center", marginBottom: 10 },
  fotoDoc: { width: "48%", height: 130, borderRadius: 10, backgroundColor: COLORS.grisClaro },

  estrellasCard: { backgroundColor: '#0F172A', borderColor: '#1E293B' },
  estrellaBadge: {
    backgroundColor: 'rgba(245,158,11,0.2)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  estrellaBadgeTxt: {
    color: '#F59E0B',
    fontWeight: '900',
    fontSize: 14,
  },
  estrellasRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 12,
  },
  estrellaItem: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.15)',
  },
  estrellaItemActiva: {
    color: '#F59E0B',
  },
  btnEstrellas: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  btnEstrellasTxt: {
    color: '#F59E0B',
    fontWeight: '700',
    fontSize: 13,
  },
});


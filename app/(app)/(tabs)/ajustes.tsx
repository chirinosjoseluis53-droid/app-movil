import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useMutation, useQuery } from "../../../lib/api";
import { api } from "../../../lib/api";
import {
  Card, SectionTitle, Button, Input, Row, COLORS,
} from "../../../lib/ui";
import { PantallaAdmin } from "../../../lib/pantalla-admin";
import { useSesion } from "../../../lib/sesion";
import { pesoLegible } from "../../../lib/respaldo";
import { enviarCorreoAPI } from "../../../lib/correos";

export default function Ajustes() {
  const { cerrar } = useSesion();
  const cfg = useQuery(api.settings.getConfig);
  const updateConfig = useMutation(api.settings.updateConfig);
  const cambiarUsuarioAdmin = useMutation(api.auth.cambiarUsuarioAdmin);
  const respaldo = useMutation(api.sistema.respaldo);
  const respaldos = useQuery(api.sistema.respaldos);
  const borrarRespaldo = useMutation(api.sistema.borrarRespaldo);

  const [negocio, setNegocio] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [pais, setPais] = useState("");
  const [moneda, setMoneda] = useState("");
  const [tasa, setTasa] = useState("");
  const [mora, setMora] = useState("");
  const [recargo, setRecargo] = useState("");
  const [gracia, setGracia] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [msg, setMsg] = useState("");
  const [act, setAct] = useState(cfg?.negocio_nombre !== undefined);

  const [usuario, setUsuario] = useState("");
  const [pa, setPa] = useState("");
  const [pn, setPn] = useState("");
  const [msgPwd, setMsgPwd] = useState("");
  const [msgRespaldo, setMsgRespaldo] = useState("");

  const [correoPrueba, setCorreoPrueba] = useState("");
  const [msgCorreo, setMsgCorreo] = useState("");
  const [loadingCorreo, setLoadingCorreo] = useState(false);

  // Sincroniza con los datos cargados
  React.useEffect(() => {
    if (cfg && !act) {
      setNegocio(cfg.negocio_nombre || "");
      setWhatsapp(cfg.whatsapp_numero || "");
      setPais(cfg.pais_wa || "58");
      setMoneda(cfg.moneda || "");
      setTasa(String(cfg.tasa_interes ?? ""));
      setMora(String(cfg.tasa_mora ?? ""));
      setRecargo(String(cfg.recargo_atraso ?? ""));
      setGracia(String(cfg.dias_gracia ?? ""));
      setMensaje(cfg.mensaje_recordatorio || "");
      setAct(true);
    }
  }, [cfg]);

  async function guardar() {
    setMsg("");
    await updateConfig({
      negocio_nombre: negocio,
      whatsapp_numero: whatsapp,
      pais_wa: pais,
      moneda,
      tasa_interes: tasa ? Number(tasa) : undefined,
      tasa_mora: mora ? Number(mora) : undefined,
      recargo_atraso: recargo ? Number(recargo) : undefined,
      dias_gracia: gracia ? Number(gracia) : undefined,
      mensaje_recordatorio: mensaje,
    });
    setMsg("Configuración guardada ✅");
  }

  async function guardarAcceso() {
    setMsgPwd("");
    try {
      await cambiarUsuarioAdmin({
        usuarioNuevo: usuario.trim() || undefined,
        passwordActual: pa,
        passwordNueva: pn || undefined,
      });
      setMsgPwd("Acceso actualizado ✅");
      setUsuario("");
      setPa("");
      setPn("");
    } catch (e: any) {
      setMsgPwd(e?.message || "Error");
    }
  }

  async function hacerRespaldo() {
    setMsgRespaldo("Generando respaldo…");
    try {
      const r: any = await respaldo();
      setMsgRespaldo(
        r?.ok
          ? `Respaldo creado: ${r.nombre} (${pesoLegible(r.bytes || 0)})${
              r.compartido ? " · se abrió el menú para guardarlo" : " · guárdalo desde Archivos"
            }`
          : r?.error || "No se pudo crear el respaldo"
      );
    } catch (e: any) {
      setMsgRespaldo(e?.message || "No se pudo crear el respaldo");
    }
  }

  async function enviarPrueba() {
    if (!correoPrueba.includes("@")) return setMsgCorreo("Ingresa un correo válido");
    setMsgCorreo("");
    setLoadingCorreo(true);
    const html = `<h2>¡Prueba Exitosa! 🚀</h2>
                  <p>Si estás viendo esto, significa que el servidor de correos está funcionando correctamente y conectado a la App Móvil.</p>
                  <p>El sistema ahora puede enviarte notificaciones.</p>`;
    const res = await enviarCorreoAPI(correoPrueba, "Notificación de Prueba - App Préstamos", html);
    setLoadingCorreo(false);
    if (res.success) {
      setMsgCorreo("Correo enviado ✅ Revisa tu bandeja de entrada.");
    } else {
      setMsgCorreo("Error: " + (res.error || "No se pudo conectar con el servidor"));
    }
  }

  return (
    <PantallaAdmin titulo="Ajustes de sistema" activo="ajustes">

      <SectionTitle>Negocio</SectionTitle>
      <Card>
        <Input label="Nombre del negocio" value={negocio} onChangeText={setNegocio} />
        <Input
          label="Número de WhatsApp del negocio"
          value={whatsapp}
          onChangeText={setWhatsapp}
          keyboardType="phone-pad"
        />
        <Input
          label="Prefijo del país para enviar WhatsApp"
          value={pais}
          onChangeText={setPais}
          keyboardType="phone-pad"
        />
        <Text style={styles.nota}>
          Ej: 58 (Venezuela), 57 (Colombia), 56 (Chile). Solo se usa si el teléfono del cliente no
          trae el código de país.
        </Text>
        <Input label="Moneda por defecto" value={moneda} onChangeText={setMoneda} />
        {msg ? <Text style={styles.ok}>{msg}</Text> : null}
      </Card>

      <SectionTitle>Interés y mora</SectionTitle>
      <Card>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Input label="Tasa por defecto %" value={tasa} onChangeText={setTasa} keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Mora % por día" value={mora} onChangeText={setMora} keyboardType="numeric" />
          </View>
        </View>
        <Text style={styles.nota}>
          El % de interés es el total del préstamo (un 10% sobre 100 = 110 a pagar), no diario ni
          mensual. Solo se usa si no hay ninguna tasa registrada en la ventana Interés.
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Input
              label="Recargo fijo por atraso"
              value={recargo}
              onChangeText={setRecargo}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Días de gracia"
              value={gracia}
              onChangeText={setGracia}
              keyboardType="numeric"
            />
          </View>
        </View>
        <Text style={styles.nota}>
          El recargo es un monto fijo en la moneda del préstamo y se cobra una sola vez. La mora solo
          empieza a contar después de los días de gracia.
        </Text>
      </Card>

      <SectionTitle>Recordatorios</SectionTitle>
      <Card>
        <Input label="Mensaje de recordatorio" value={mensaje} onChangeText={setMensaje} multiline />
        <Text style={styles.nota}>
          Variables disponibles: {"{nombre}"}, {"{monto}"}, {"{vencimiento}"}, {"{negocio}"}
        </Text>
        <Button title="Guardar configuración" onPress={guardar} />
      </Card>

      <SectionTitle>Acceso del administrador</SectionTitle>
      <Card>
        <Row label="Usuario actual" value={cfg?.admin_user || "admin"} />
        <Input
          label="Nuevo usuario (opcional)"
          value={usuario}
          onChangeText={setUsuario}
          autoCapitalize="none"
        />
        <Input label="Contraseña actual" value={pa} onChangeText={setPa} secureTextEntry />
        <Input
          label="Nueva contraseña (opcional)"
          value={pn}
          onChangeText={setPn}
          secureTextEntry
        />
        {msgPwd ? (
          <Text style={[styles.ok, msgPwd === "Error" ? { color: COLORS.rojo } : {}]}>{msgPwd}</Text>
        ) : null}
        <Button
          title="Actualizar acceso"
          variant="secondary"
          onPress={guardarAcceso}
        />
        <Text style={styles.nota}>
          Este usuario es el único que entra al panel. Se confirmó que ya no queda un usuario fijo
          "admin" por fuera de la base de datos.
        </Text>
      </Card>

      <SectionTitle>Notificaciones por correo</SectionTitle>
      <Card>
        <Text style={styles.nota}>
          Verifica que el servidor local (backend-correos.js) esté en ejecución. Ingresa un correo para probar el envío.
        </Text>
        <Input label="Correo destino" value={correoPrueba} onChangeText={setCorreoPrueba} keyboardType="email-address" autoCapitalize="none" />
        {msgCorreo ? (
          <Text style={[styles.ok, msgCorreo.includes("Error") ? { color: COLORS.rojo } : {}]}>{msgCorreo}</Text>
        ) : null}
        <Button
          title="Enviar correo de prueba"
          variant="secondary"
          loading={loadingCorreo}
          onPress={enviarPrueba}
        />
      </Card>

      <SectionTitle>Respaldo de datos</SectionTitle>
      <Card>
        <Text style={styles.nota}>
          La información vive solo en este teléfono. Genera un respaldo y guárdalo en Drive, correo o
          WhatsApp para no perder la cartera si se desinstala la app.
        </Text>
        <Button title="Generar y compartir respaldo" variant="secondary" onPress={hacerRespaldo} />
        {msgRespaldo ? <Text style={styles.nota}>{msgRespaldo}</Text> : null}
        {Array.isArray(respaldos) && respaldos.length ? (
          <View style={{ marginTop: 12, gap: 8 }}>
            <Text style={styles.nota}>Respaldos guardados en el teléfono</Text>
            {respaldos.slice(0, 5).map((r: any) => (
              <View key={r.nombre} style={styles.respaldoFila}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.respaldoNombre}>{r.nombre}</Text>
                  <Text style={styles.nota}>
                    {r.fecha} · {pesoLegible(r.bytes)}
                  </Text>
                </View>
                <Button
                  title="Borrar"
                  variant="ghost"
                  small
                  onPress={() => borrarRespaldo({ ruta: r.ruta })}
                />
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      <SectionTitle>Sobre el sistema</SectionTitle>
      <Card>
        <Text style={styles.sobre}>
          App móvil de Control de Préstamos construida con React Native (Expo) y SQLite local como base de datos.
        </Text>
        <Row label="Base de datos" value="SQLite en el dispositivo" />
        <Row label="Usuario admin" value={cfg?.admin_user || "admin"} />
      </Card>

      <Button title="Cerrar sesión" variant="danger" onPress={() => cerrar()} />
    </PantallaAdmin>
  );
}

const styles = StyleSheet.create({
  ok: { color: COLORS.verde, marginBottom: 8, fontWeight: "700" },
  nota: { color: COLORS.textoSuave, fontSize: 12, marginTop: -6, marginBottom: 10, lineHeight: 16 },
  sobre: { color: COLORS.textoSuave, fontSize: 13, marginBottom: 10, lineHeight: 18 },
  respaldoFila: { flexDirection: "row", alignItems: "center", gap: 8 },
  respaldoNombre: { color: COLORS.texto, fontSize: 12, fontWeight: "700" },
});

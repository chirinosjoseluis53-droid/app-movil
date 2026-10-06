import React, { useEffect, useState } from "react";
import { View, Text, Image, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api, useMutation, useQuery } from "../../lib/api";
import { persistLocalImage } from "../../lib/media";
import { PantallaCliente } from "../../lib/pantalla-cliente";
import { useSesion } from "../../lib/sesion";
import { Badge, Button, Card, COLORS, fmt, Input, Row, Select } from "../../lib/ui";

const METODOS = { transferencia: "Transferencia", efectivo: "Efectivo" };
type Metodo = keyof typeof METODOS;

export default function Pagar() {
  const { sesion } = useSesion();
  const clienteId = sesion?.rol === "cliente" ? sesion.clienteId : undefined;
  const me: any = useQuery(api.portalCliente.me, clienteId ? { clienteId } : "skip");
  const prestamos: any[] = useQuery(api.portalCliente.misPrestamos, clienteId ? { clienteId } : "skip") || [];

  const pagar = useMutation(api.portalCliente.pagar);

  const [prestamoSel, setPrestamoSel] = useState("");
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState<Metodo>("transferencia");
  const [referencia, setReferencia] = useState("");
  const [comprobante, setComprobante] = useState<string | null>(null);
  const [fecha, setFecha] = useState("");
  const [cedula, setCedula] = useState("");
  const [telefono, setTelefono] = useState("");
  const [er, setEr] = useState("");
  const [ok, setOk] = useState("");
  const [esperando, setEsperando] = useState(false);

  // los datos llegan de forma asíncrona: se rellenan una vez disponibles
  useEffect(() => {
    if (me?.cedula) setCedula((v) => v || me.cedula);
    if (me?.telefono) setTelefono((v) => v || me.telefono);
  }, [me?.cedula, me?.telefono]);

  const disponibles = prestamos.filter((p) => (Number(p.saldo) || 0) > 0);
  const etiqueta = (p: any) => `${p.moneda} ${fmt(p.monto)} · saldo ${fmt(p.saldo)}`;
  const opts = disponibles.map(etiqueta);
  const prestamoDe = (lbl: string) => disponibles.find((p: any) => etiqueta(p) === lbl);

  // al cambiar de préstamo se sugiere el saldo completo
  const elegirPrestamo = (lbl: string) => {
    setPrestamoSel(lbl);
    const p = prestamoDe(lbl);
    if (p) setMonto(String(p.saldo));
  };

  async function elegirComprobante() {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      setEr("Necesitas permitir el acceso a las fotos");
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.5 });
    if (!r.canceled && r.assets.length) setComprobante(r.assets[0].uri);
  }

  async function enviar() {
    setEr("");
    setOk("");
    setEsperando(true);
    try {
      const p = prestamoDe(prestamoSel);
      if (!p) throw new Error("Selecciona un préstamo con saldo");
      if (!monto || Number(monto) <= 0) throw new Error("Ingresa un monto válido");
      let comprobanteId: string | undefined;
      if (comprobante) comprobanteId = await persistLocalImage(comprobante, "comprobantes");
      await pagar({
        clienteId: clienteId!,
        prestamoId: p._id,
        monto: Number(monto),
        metodo,
        referencia: referencia || undefined,
        comprobante: comprobanteId,
        fechaPago: fecha || undefined,
        telefono,
        cedula,
      });
      setOk("¡Pago enviado! Queda pendiente de revisión por el administrador. ✅");
      setMonto("");
      setReferencia("");
      setComprobante(null);
    } catch (e: any) {
      setEr(e?.message || "Error al enviar el pago");
    } finally {
      setEsperando(false);
    }
  }

  const seleccionado = prestamoDe(prestamoSel);

  return (
    <PantallaCliente
      titulo="Pagar / abonar"
      subtitulo={disponibles.length ? `${disponibles.length} préstamo(s) con saldo` : "Sin saldo pendiente"}
      activo="pagar"
    >
      {!disponibles.length ? (
        <Card>
          <Text style={{ color: COLORS.textoSuave }}>No tienes préstamos con saldo pendiente.</Text>
        </Card>
      ) : null}

      {seleccionado ? (
        <Card style={{ backgroundColor: COLORS.azulClaro, borderColor: COLORS.azul }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: COLORS.azul, fontWeight: "800" }}>
                {seleccionado.moneda} {fmt(seleccionado.saldo)}
              </Text>
              <Text style={{ color: COLORS.textoSuave, fontSize: 12 }}>Saldo de este préstamo</Text>
            </View>
            <Badge estado={seleccionado.estado} />
          </View>
        </Card>
      ) : null}

      <Card>
        <Select label="Préstamo" value={prestamoSel} onChange={elegirPrestamo} options={opts} />
        <Input
          label="Monto a pagar *"
          value={monto}
          onChangeText={setMonto}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        <Select
          label="Método de pago"
          value={metodo}
          onChange={(v) => setMetodo(v as Metodo)}
          options={Object.keys(METODOS)}
          optionsLabel={METODOS}
        />
        {metodo === "transferencia" ? (
          <Input
            label="Número de referencia *"
            value={referencia}
            onChangeText={setReferencia}
            placeholder="Ej. 123456789"
            autoCapitalize="none"
          />
        ) : null}
        <Input
          label="Fecha de pago (AAAA-MM-DD)"
          value={fecha}
          onChangeText={setFecha}
          placeholder="Hoy"
          autoCapitalize="none"
        />
      </Card>

      <Card>
        <Text style={styles.label}>Comprobante (opcional)</Text>
        <TouchableOpacity style={styles.compBox} onPress={elegirComprobante}>
          {comprobante ? (
            <Image source={{ uri: comprobante }} style={styles.compImg} />
          ) : (
            <Text style={{ color: COLORS.azul, fontWeight: "700" }}>+ Subir comprobante</Text>
          )}
        </TouchableOpacity>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Input label="Tu cédula" value={cedula} onChangeText={setCedula} autoCapitalize="none" />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Tu teléfono" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" />
          </View>
        </View>
      </Card>

      {er ? <Text style={styles.er}>{er}</Text> : null}
      {ok ? <Text style={styles.ok}>{ok}</Text> : null}

      <Button
        title="Enviar pago"
        onPress={enviar}
        loading={esperando}
        disabled={!disponibles.length}
        style={{ marginTop: 4 }}
      />

      <Row label="Soporte" value="Contacta con el administrador ante cualquier duda" />
    </PantallaCliente>
  );
}

const styles = StyleSheet.create({
  label: { color: COLORS.textoSuave, fontSize: 13, marginBottom: 5, fontWeight: "600" },
  compBox: {
    height: 90,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.azul,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    overflow: "hidden",
  },
  compImg: { width: "100%", height: "100%" },
  er: { color: COLORS.rojo, marginBottom: 10, fontWeight: "600" },
  ok: { color: COLORS.verde, marginBottom: 10, fontWeight: "700" },
});

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Image,
  Animated,
  useWindowDimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ───────────────────────── Tema ─────────────────────────
export const COLORS = {
  azul: "#0F172A", // Dark Slate para headers
  azul2: "#1E293B",
  azulClaro: "#334155",
  azul900: "#0F172A",
  azul800: "#1E293B",
  azul600: "#10B981", // Emerald principal en lugar del azul viejo
  azul100: "#D1FAE5",
  azul50: "#ECFDF5",
  teal: "#10B981", // Emerald
  tealClaro: "#D1FAE5",
  blanco: "#ffffff",
  bg: "#F8FAFC",
  texto: "#0F172A",
  textoSuave: "#64748B",
  borde: "#E2E8F0",
  verde: "#10B981",
  verdeClaro: "#D1FAE5",
  rojo: "#EF4444",
  rojoClaro: "#FEE2E2",
  naranja: "#F59E0B",
  naranjaClaro: "#FEF3C7",
  gris: "#9CA3AF",
  grisClaro: "#F1F5F9",
};

// ───────────────────────── Formato ─────────────────────────
export const fmt = (n: number): string =>
  new Intl.NumberFormat("es-VE", { maximumFractionDigits: 2 }).format(Number(n || 0));

export const fmtDinero = (monto: number, moneda?: string): string =>
  `${moneda || "BS"} ${fmt(monto)}`;

export const COLORS_ESTADO: Record<string, { bg: string; fg: string; label: string }> = {
  activo: { bg: COLORS.verdeClaro, fg: COLORS.verde, label: "Activo" },
  atrasado: { bg: COLORS.rojoClaro, fg: COLORS.rojo, label: "Atrasado" },
  pagado: { bg: COLORS.grisClaro, fg: COLORS.gris, label: "Pagado" },
  pendiente: { bg: COLORS.naranjaClaro, fg: COLORS.naranja, label: "Pendiente" },
  aprobado: { bg: COLORS.verdeClaro, fg: COLORS.verde, label: "Aprobado" },
  rechazado: { bg: COLORS.rojoClaro, fg: COLORS.rojo, label: "Rechazado" },
  bloqueado: { bg: COLORS.rojoClaro, fg: COLORS.rojo, label: "Bloqueado" },
};

// ───────────────────────── Componentes base ─────────────────────────
export function Screen({
  children,
  scroll,
  pad = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  pad?: boolean;
}) {
  const content = (
    <View style={[styles.screen, pad && { padding: 16 }]}>{children}</View>
  );
  if (scroll) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    );
  }
  return content;
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({ label, value, style }: { label: string; value: React.ReactNode; style?: any }) {
  return (
    <View style={[styles.row, style]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function SectionTitle({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[styles.sectionTitle, style]}>{children}</Text>;
}

export function Badge({ estado }: { estado: string }) {
  const c = COLORS_ESTADO[estado] || {
    bg: COLORS.grisClaro,
    fg: COLORS.gris,
    label: estado,
  };
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.fg }]}>{c.label}</Text>
    </View>
  );
}

type BotonVariant = "primary" | "secondary" | "danger" | "outline" | "ghost";

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  loading,
  small,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: BotonVariant;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: any;
}) {
  const paleta: Record<BotonVariant, { bg: string; fg: string; borde?: string }> = {
    primary: { bg: COLORS.azul, fg: COLORS.blanco },
    secondary: { bg: COLORS.azulClaro, fg: COLORS.azul },
    danger: { bg: COLORS.rojo, fg: COLORS.blanco },
    outline: { bg: COLORS.blanco, fg: COLORS.azul, borde: COLORS.azul },
    ghost: { bg: COLORS.blanco, fg: COLORS.textoSuave },
  };
  const p = paleta[variant];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        { backgroundColor: p.bg, borderWidth: p.borde ? 1 : 0, borderColor: p.borde },
        small && styles.buttonSmall,
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} size="small" />
      ) : (
        <Text style={[styles.buttonText, { color: p.fg }, small && styles.buttonTextSmall]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  secureTextEntry,
  autoCapitalize,
  autoCorrect,
  style,
}: {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: any;
  multiline?: boolean;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  style?: any;
}) {
  return (
    <View style={[styles.field, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.gris}
        keyboardType={keyboardType}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        style={[styles.input, multiline && { minHeight: 80, textAlignVertical: "top" }]}
      />
    </View>
  );
}

// Select simple (modal con opciones)
export function Select({
  label,
  value,
  onChange,
  options,
  optionsLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  optionsLabel?: Record<string, string>;
}) {
  const [abierto, setAbierto] = useState(false);
  const mostrar = (optionsLabel && optionsLabel[value]) || value;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.select} onPress={() => setAbierto(true)}>
        <Text style={{ color: mostrar ? COLORS.texto : COLORS.gris }}>{mostrar || "Elige..."}</Text>
        <Text style={{ color: COLORS.gris }}>▾</Text>
      </TouchableOpacity>
      <Modal visible={abierto} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setAbierto(false)}>
          <View style={styles.modalBottom}>
            <Text style={styles.modalTitle}>{label}</Text>
            {options.map((o) => {
              const lbl = (optionsLabel && optionsLabel[o]) || o;
              return (
                <TouchableOpacity
                  key={o}
                  style={[
                    styles.optionRow,
                    o === value && { backgroundColor: COLORS.azulClaro },
                  ]}
                  onPress={() => {
                    onChange(o);
                    setAbierto(false);
                  }}
                >
                  <Text style={o === value ? { color: COLORS.azul, fontWeight: "700" } : { color: COLORS.texto }}>
                    {lbl}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export function SearchBar({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  return (
    <View style={styles.search}>
      <Text style={{ color: COLORS.gris }}>⌕</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Buscar..."
        placeholderTextColor={COLORS.gris}
        style={styles.searchInput}
      />
    </View>
  );
}

export function StatCard({
  label,
  valor,
  sub,
  color = COLORS.azul,
}: {
  label: string;
  valor: string;
  sub?: string;
  color?: string;
}) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValor, { color }]}>{valor}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

export function Empty({ mensaje }: { mensaje: string }) {
  return (
    <View style={styles.empty}>
      <Text style={{ color: COLORS.gris, textAlign: "center" }}>{mensaje}</Text>
    </View>
  );
}

export function Fab({ titulo, onPress }: { titulo: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.fab} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.fabText}>+ {titulo}</Text>
    </TouchableOpacity>
  );
}

export function ModalSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalOverlay}
      >
        <Pressable style={styles.modalBgFlex} onPress={onClose} />
        <View style={styles.modalBottom}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: "86%" }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Confirmar({
  visible,
  titulo,
  mensaje,
  onCancel,
  onConfirm,
  peligro,
}: {
  visible: boolean;
  titulo: string;
  mensaje?: string;
  onCancel: () => void;
  onConfirm: () => void;
  peligro?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.confirmBox}>
          <Text style={[styles.modalTitle, { textAlign: "center" }]}>{titulo}</Text>
          {mensaje ? <Text style={{ color: COLORS.textoSuave, marginTop: 8 }}>{mensaje}</Text> : null}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 20 }}>
            <View style={{ flex: 1 }}>
              <Button title="Cancelar" variant="ghost" onPress={onCancel} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Confirmar"
                variant={peligro ? "danger" : "primary"}
                onPress={onConfirm}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function Chip({
  activo,
  label,
  onPress,
}: {
  activo: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, activo && { backgroundColor: COLORS.azul, borderColor: COLORS.azul }]}
    >
      <Text style={{ color: activo ? COLORS.blanco : COLORS.textoSuave, fontSize: 13, fontWeight: "600" }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ───────────────────────── Menú lateral ─────────────────────────

export type OpcionMenu = {
  clave: string;
  titulo: string;
  icono: string;
  ruta: string;
  badge?: string;
};

export const MENU_CLIENTE: OpcionMenu[] = [
  { clave: "inicio", titulo: "Inicio", icono: "🏠", ruta: "/cliente" },
  { clave: "prestamos", titulo: "Mis préstamos", icono: "💼", ruta: "/cliente/prestamos" },
  { clave: "solicitar", titulo: "Solicitar préstamo", icono: "📝", ruta: "/cliente/solicitar" },
  { clave: "pagar", titulo: "Pagar / abonar", icono: "💸", ruta: "/cliente/pagar" },
  { clave: "pagos", titulo: "Mis pagos", icono: "💳", ruta: "/cliente/pagos" },
  { clave: "historial", titulo: "Historial", icono: "🕘", ruta: "/cliente/historial" },
  { clave: "reportes", titulo: "Reportes", icono: "📊", ruta: "/cliente/reportes" },
  { clave: "calculadora", titulo: "Calculadora", icono: "🧮", ruta: "/cliente/calculadora" },
  { clave: "tasa", titulo: "Tasa del día", icono: "💱", ruta: "/cliente/tasa-dia" },
  { clave: "calendario", titulo: "Calendario de pagos", icono: "📅", ruta: "/cliente/calendario" },
  { clave: "perfil", titulo: "Mi perfil", icono: "👤", ruta: "/cliente/perfil" },
];

export const MENU_ADMIN: OpcionMenu[] = [
  { clave: "prestamos", titulo: "Préstamos", icono: "💰", ruta: "/prestamos" },
  { clave: "clientes", titulo: "Clientes", icono: "👥", ruta: "/clientes" },
  { clave: "ajustes", titulo: "Ajustes", icono: "⚙️", ruta: "/ajustes" },
  { clave: "reportes", titulo: "Reportes", icono: "📊", ruta: "/reportes" },
  { clave: "calendario", titulo: "Calendario", icono: "📅", ruta: "/calendario" },
  { clave: "tasa", titulo: "Tasa del día", icono: "💱", ruta: "/tasa-dia" },
  { clave: "interes", titulo: "Interés", icono: "📈", ruta: "/interes" },
];

type MenuContext = {
  abierto: boolean;
  setAbierto: (v: boolean) => void;
  activo: string;
};

export const MenuContextReact = React.createContext<MenuContext>({
  abierto: false,
  setAbierto: () => {},
  activo: "inicio",
});

export function useMenu() {
  return React.useContext(MenuContextReact);
}

// Botón de hamburguesa. Se usa solo dentro del menú.
export function BotonMenu({ onPress, color = COLORS.texto }: { onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={styles.menuBtn} accessibilityLabel="Abrir menú">
      <View style={[styles.barra, { backgroundColor: color }]} />
      <View style={[styles.barra, { backgroundColor: color }]} />
      <View style={[styles.barra, { backgroundColor: color }]} />
    </Pressable>
  );
}

// Panel deslizante con las opciones del menú.
export function MenuLateral({
  visible,
  onClose,
  activo,
  opciones,
  onNavegar,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  activo: string;
  opciones: OpcionMenu[];
  onNavegar: (ruta: string) => void;
  children?: React.ReactNode;
}) {
  const ancho = useWindowDimensions().width;
  const anchoPanel = Math.min(300, ancho * 0.82);
  const x = React.useRef(new Animated.Value(-anchoPanel - 20)).current;
  const fondo = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(x, {
        toValue: visible ? 0 : -anchoPanel - 20,
        duration: visible ? 220 : 160,
        useNativeDriver: true,
      }),
      Animated.timing(fondo, {
        toValue: visible ? 1 : 0,
        duration: visible ? 220 : 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible]);

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.menuCapa]}
      pointerEvents={visible ? "auto" : "none"}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.menuFondo, { opacity: fondo }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[
          styles.menuPanel,
          { width: anchoPanel, transform: [{ translateX: x }] },
        ]}
      >
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
          {children}
          {opciones.map((o) => {
            const on = o.clave === activo;
            return (
              <Pressable
                key={o.clave}
                onPress={() => {
                  onClose();
                  onNavegar(o.ruta);
                }}
                style={[styles.menuItem, on && styles.menuItemOn]}
              >
                <Text style={styles.menuIcono}>{o.icono}</Text>
                <Text style={[styles.menuTexto, on && { color: COLORS.blanco, fontWeight: "700" }]}>
                  {o.titulo}
                </Text>
                {o.badge ? (
                  <View style={styles.menuBadge}>
                    <Text style={styles.menuBadgeTexto}>{o.badge}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

// ───────────────────────── Tarjetas de apoyo ─────────────────────────

// Bandera del país de una moneda, desde el servicio público flagcdn.
export function Bandera({ codigo, size = 30 }: { codigo: string; size?: number }) {
  const cc = String(codigo || "").toLowerCase().slice(0, 2);
  const ratio = cc === "us" ? 1.9 : 1.35;
  return (
    <View
      style={{
        width: size * ratio,
        height: size,
        borderRadius: 3,
        overflow: "hidden",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: COLORS.borde,
        backgroundColor: COLORS.grisClaro,
      }}
    >
      <Image
        source={{ uri: `https://flagcdn.com/w80/${cc}.png` }}
        style={{ width: "100%", height: "100%" }}
        resizeMode="cover"
      />
    </View>
  );
}

// Franja azul superior: evita que el contenido quede pegado al borde y
// unifica el encabezado de todas las ventanas del cliente.
import { LinearGradient } from "expo-linear-gradient";

export function FranjaAzul({
  titulo,
  subtitulo,
  onMenu,
  onBack,
  derecha,
}: {
  titulo: string;
  subtitulo?: string;
  onMenu: () => void;
  onBack?: () => void;
  derecha?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient colors={['#0F172A', '#1E293B']} style={[styles.franjaAzul, { paddingTop: Math.max(insets.top, 30) + 10 }]}>
      <View style={styles.franjaFila}>
        <BotonMenu onPress={onMenu} color={COLORS.blanco} />
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={10} style={{ paddingHorizontal: 2 }}>
            <Ionicons name="arrow-back" size={26} color={COLORS.blanco} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.franjaTitulo} numberOfLines={1}>
            {titulo}
          </Text>
          {subtitulo ? (
            <Text style={styles.franjaSub} numberOfLines={1}>
              {subtitulo}
            </Text>
          ) : null}
        </View>
        {derecha}
      </View>
    </LinearGradient>
  );
}

export function Foto({ uri, size = 64, borde }: { uri?: string | null; size?: number; borde?: boolean }) {
  const marco = borde
    ? { borderWidth: 2, borderColor: "rgba(255,255,255,0.75)" }
    : null;
  if (!uri) {
    return (
      <View
        style={[
          styles.fotoVacia,
          { width: size, height: size, borderRadius: size / 2 },
          marco,
        ]}
      >
        <Text style={{ fontSize: size * 0.42 }}>👤</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: COLORS.grisClaro,
        },
        marco,
      ]}
    />
  );
}

// ───────────────────────── Estilos ─────────────────────────
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  card: {
    backgroundColor: COLORS.blanco,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borde,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  rowLabel: { color: COLORS.textoSuave, fontSize: 13 },
  rowValue: { color: COLORS.texto, fontSize: 14, fontWeight: "600", maxWidth: "65%" },
  sectionTitle: {
    color: COLORS.texto,
    fontWeight: "700",
    fontSize: 16,
    marginTop: 8,
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
  button: {
    backgroundColor: COLORS.azul,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  buttonSmall: { paddingVertical: 8, paddingHorizontal: 12, marginBottom: 0 },
  buttonText: { color: COLORS.blanco, fontWeight: "700", fontSize: 15 },
  buttonTextSmall: { fontSize: 13 },
  field: { marginBottom: 12 },
  label: { color: COLORS.textoSuave, fontSize: 13, marginBottom: 5, fontWeight: "600" },
  input: {
    backgroundColor: COLORS.blanco,
    borderWidth: 1,
    borderColor: COLORS.borde,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.texto,
  },
  select: {
    backgroundColor: COLORS.blanco,
    borderWidth: 1,
    borderColor: COLORS.borde,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  search: {
    backgroundColor: COLORS.blanco,
    borderWidth: 1,
    borderColor: COLORS.borde,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: COLORS.texto },
  statCard: {
    backgroundColor: COLORS.blanco,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borde,
    borderTopWidth: 4,
    padding: 14,
  },
  statLabel: { color: COLORS.textoSuave, fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  statValor: { fontSize: 22, fontWeight: "800", marginTop: 4 },
  statSub: { color: COLORS.textoSuave, fontSize: 12, marginTop: 2 },
  empty: { padding: 30, alignItems: "center" },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 20,
    backgroundColor: COLORS.azul,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 30,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabText: { color: COLORS.blanco, fontWeight: "800", fontSize: 15 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    justifyContent: "center",
    padding: 16,
  },
  modalBgFlex: { flex: 1 },
  modalBottom: {
    backgroundColor: COLORS.blanco,
    borderRadius: 20,
    padding: 20,
    paddingBottom: 30,
  },
  modalHandle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.grisClaro,
    marginBottom: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: "800", color: COLORS.texto, marginBottom: 12 },
  optionRow: {
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2,
  },
  confirmBox: {
    backgroundColor: COLORS.blanco,
    borderRadius: 18,
    padding: 20,
  },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.borde,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
  },
  menuBtn: { padding: 6, gap: 4 },
  barra: { width: 20, height: 2, borderRadius: 1 },
  menuFondo: { backgroundColor: "rgba(15,23,42,0.6)" },
  // por encima de cualquier barra fija del dashboard
  menuCapa: { zIndex: 40, elevation: 20 },
  menuPanel: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: '#0F172A',
    paddingTop: 40,
    zIndex: 50,
    elevation: 24,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 15,
    shadowOffset: { width: 6, height: 0 },
    borderTopRightRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 12,
    borderRadius: 14,
    gap: 12,
    marginBottom: 4,
  },
  menuItemOn: { backgroundColor: "rgba(255,255,255,0.1)" },
  menuIcono: { fontSize: 20, width: 26, textAlign: "center", color: '#F8FAFC' },
  menuTexto: { color: "#94A3B8", fontSize: 15, flex: 1, fontWeight: "600" },
  menuBadge: {
    backgroundColor: COLORS.verde,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  menuBadgeTexto: { color: COLORS.blanco, fontSize: 10, fontWeight: "800" },
  menuPerfil: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginHorizontal: 12,
    marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
  },
  menuNombre: { color: COLORS.blanco, fontWeight: "800", fontSize: 16, marginTop: 12 },
  menuCorreo: { color: "#94A3B8", fontSize: 13, marginTop: 4 },
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: COLORS.bg,
  },
  franjaAzul: {
    backgroundColor: COLORS.azul,
    paddingTop: 22,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  franjaFila: { flexDirection: "row", alignItems: "center", gap: 12 },
  franjaTitulo: { color: COLORS.blanco, fontSize: 19, fontWeight: "800" },
  franjaSub: { color: "#A9B6C6", fontSize: 12, marginTop: 2 },
  cabeceraTitulo: { color: COLORS.texto, fontSize: 18, fontWeight: "800", flex: 1 },
  fotoVacia: {
    backgroundColor: COLORS.azulClaro,
    alignItems: "center",
    justifyContent: "center",
  },
});
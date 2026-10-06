import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Dimensions, StatusBar, Pressable
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "../../../lib/api";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../../lib/api";
import { COLORS, Empty, Foto, MENU_ADMIN, MenuLateral } from "../../../lib/ui";
import { styles as uiStyles } from "../../../lib/ui";
import { useSesion } from "../../../lib/sesion";
import { LineChart } from "react-native-chart-kit";

const { width } = Dimensions.get("window");

// Los montos se muestran por moneda: sumar Bs + USD + COP no tiene sentido.
function resumenCartera(mapa?: Record<string, number>): string {
  if (!mapa) return "";
  const partes = Object.keys(mapa)
    .filter((m) => Number(mapa[m]) > 0)
    .map(
      (m) =>
        `${m} ${Number(mapa[m]).toLocaleString("es", { maximumFractionDigits: 0 })}`
    );
  if (!partes.length) return "";
  return partes.slice(0, 2).join(" · ") + (partes.length > 2 ? ` +${partes.length - 2}` : "");
}

// Acciones rápidas del admin
const ACCIONES = [
  { icono: "people-outline",      label: "Clientes",       ruta: "/clientes",   color: "#6366F1", bg: "rgba(99,102,241,0.12)" },
  { icono: "cash-outline",        label: "Préstamos",      ruta: "/prestamos",  color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  { icono: "calendar-outline",    label: "Calendario",     ruta: "/calendario", color: "#F59E0B", bg: "rgba(245,158,11,0.12)"  },
  { icono: "bar-chart-outline",   label: "Reportes",       ruta: "/reportes",   color: "#EC4899", bg: "rgba(236,72,153,0.12)" },
  { icono: "trending-up-outline", label: "Tasa del día",   ruta: "/tasa-dia",   color: "#14B8A6", bg: "rgba(20,184,166,0.12)" },
  { icono: "stats-chart-outline", label: "Tasa interés",   ruta: "/interes",    color: "#8B5CF6", bg: "rgba(139,92,246,0.12)" },
  { icono: "settings-outline",    label: "Ajustes",        ruta: "/ajustes",    color: "#64748B", bg: "rgba(100,116,139,0.12)"},
  { icono: "document-text-outline", label: "Solicitudes",  ruta: "/solicitudes",color: "#EF4444", bg: "rgba(239,68,68,0.12)"  },
];

export default function AdminDashboard() {
  const { cerrar, sesion } = useSesion();
  const s = useQuery(api.summary.summary);
  const cargando = !s;
  const [menuAbierto, setMenuAbierto] = useState(false);

  const username = sesion?.rol === "admin" ? sesion.username : "Administrador";

  // Estadísticas principales
  const stats = [
    {
      label: "Préstamos\nactivos",
      valor: s?.prestamos_activos ?? "—",
      icono: "briefcase-outline",
      color: "#10B981",
      bg: "rgba(16,185,129,0.12)",
    },
    {
      label: "Total\nclientes",
      valor: s?.clientes ?? "—",
      icono: "people-outline",
      color: "#6366F1",
      bg: "rgba(99,102,241,0.12)",
    },
    {
      label: "Solicitudes\npendientes",
      valor: s?.solicitudes_pendientes ?? "—",
      icono: "time-outline",
      color: "#F59E0B",
      bg: "rgba(245,158,11,0.12)",
    },
    {
      label: "Préstamos\natrasados",
      valor: s?.prestamos_atrasados ?? "—",
      icono: "alert-circle-outline",
      color: "#EF4444",
      bg: "rgba(239,68,68,0.12)",
    },
  ];

  const chartConfig = {
    backgroundGradientFrom: "#FFFFFF",
    backgroundGradientTo: "#FFFFFF",
    color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`, // Verde teal
    labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
    strokeWidth: 3, // optional, default 3
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    propsForDots: {
      r: "4",
      strokeWidth: "2",
      stroke: "#10B981"
    }
  };

  const chartData = {
    labels: ["Ene", "Feb", "Mar", "Abr", "May", "Jun"],
    datasets: [
      {
        data: [2000, 4500, 2800, 8000, 9900, 12500],
        color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`, // Verde
        strokeWidth: 3
      }
    ],
    legend: ["Ingresos 6 meses (Bs)"] 
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header con gradiente */}
        <LinearGradient colors={['#0F172A', '#1E293B', '#0F172A']} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => setMenuAbierto(true)} style={styles.iconButton}>
              <Ionicons name="menu-outline" size={28} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.headerSub}>Panel de control</Text>
              <Text style={styles.headerTitle} numberOfLines={1}>{username}</Text>
            </View>

            <TouchableOpacity style={[styles.iconButton, { position: 'relative' }]}>
              <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
              {s?.notify_unread ? <View style={styles.badge} /> : null}
            </TouchableOpacity>
          </View>

          {/* Tarjeta glassmorphism de resumen (por moneda: no se suman currencies) */}
          <LinearGradient colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.04)']} style={styles.glassCard}>
            <View style={styles.glassRow}>
              <View style={styles.glassItem}>
                <Text style={styles.glassLabel}>Cartera total</Text>
                <Text style={styles.glassValue} numberOfLines={1}>
                  {resumenCartera(s?.cartera_por_moneda) || "Sin deuda"}
                </Text>
              </View>
              <View style={styles.glassDivider} />
              <View style={styles.glassItem}>
                <Text style={styles.glassLabel}>Cobrado hoy</Text>
                <Text style={[styles.glassValue, { color: '#34D399' }]} numberOfLines={1}>
                  {resumenCartera(s?.cobrado_hoy_cur) || "0"}
                </Text>
              </View>
              <View style={styles.glassDivider} />
              <View style={styles.glassItem}>
                <Text style={styles.glassLabel}>Mora total</Text>
                <Text style={[styles.glassValue, { color: '#F87171' }]} numberOfLines={1}>
                  {resumenCartera(s?.mora_por_moneda) || "0"}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </LinearGradient>

        {/* Body */}
        <View style={styles.body}>
          {/* Stats grid 2x2 */}
          <Text style={styles.sectionTitle}>Resumen general</Text>
          <View style={styles.statsGrid}>
            {stats.map((st, i) => (
              <View key={i} style={styles.statCard}>
                <View style={[styles.statIconBox, { backgroundColor: st.bg }]}>
                  <Ionicons name={st.icono as any} size={22} color={st.color} />
                </View>
                <Text style={[styles.statValue, { color: st.color }]}>{st.valor}</Text>
                <Text style={styles.statLabel}>{st.label}</Text>
              </View>
            ))}
          </View>
          
          {/* Gráfico de rendimiento */}
          <Text style={styles.sectionTitle}>Rendimiento</Text>
          <View style={styles.chartContainer}>
            <LineChart
              data={chartData}
              width={width - 40}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={{
                marginVertical: 8,
                borderRadius: 16
              }}
              withInnerLines={false}
              withOuterLines={false}
              yAxisLabel="Bs "
              yAxisSuffix=""
            />
          </View>

          {/* Acciones rápidas en grid */}
          <Text style={styles.sectionTitle}>Acciones rápidas</Text>
          <View style={styles.accionesGrid}>
            {ACCIONES.map((a, i) => (
              <TouchableOpacity
                key={i}
                style={styles.accionCard}
                onPress={() => router.push(a.ruta as any)}
                activeOpacity={0.75}
              >
                <View style={[styles.accionIcon, { backgroundColor: a.bg }]}>
                  <Ionicons name={a.icono as any} size={24} color={a.color} />
                </View>
                <Text style={styles.accionLabel} numberOfLines={1}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {cargando && <Empty mensaje="Cargando resumen..." />}
      </ScrollView>

      {/* Menú lateral */}
      <MenuLateral
        visible={menuAbierto}
        onClose={() => setMenuAbierto(false)}
        activo="dashboard"
        opciones={MENU_ADMIN}
        onNavegar={(ruta) => router.push(ruta as any)}
      >
        <LinearGradient colors={['#0F172A', '#1E293B']} style={uiStyles.menuPerfil}>
          <Foto size={64} />
          <Text style={uiStyles.menuNombre} numberOfLines={1}>{username}</Text>
          <Text style={uiStyles.menuCorreo}>Administrador</Text>
        </LinearGradient>
      </MenuLateral>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { paddingBottom: 40 },

  // Header
  header: {
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 36,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    shadowColor: '#0F172A',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  iconButton: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 22,
  },
  badge: {
    position: 'absolute', top: 8, right: 8,
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: '#EF4444',
    borderWidth: 1.5, borderColor: '#0F172A',
  },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerSub: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },

  // Glassmorphism card
  glassCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  glassRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  glassItem: { flex: 1, alignItems: 'center' },
  glassDivider: {
    width: 1, height: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  glassLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  glassValue: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },

  // Body
  body: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
  },

  // Stats 2x2 grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 28,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    width: (width - 54) / 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  statIconBox: {
    width: 46, height: 46,
    borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    lineHeight: 16,
  },

  // Chart
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 0, // El chart ya tiene sus margins internos
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    marginBottom: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Acciones rápidas grid 4 cols
  accionesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  accionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    width: (width - 56) / 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  accionIcon: {
    width: 46, height: 46,
    borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  accionLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
  },
});
import React, { useEffect, useRef, useState } from "react";
import { Animated, View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { LineChart } from "react-native-chart-kit";
import { api, useQuery } from "../../lib/api";
import { BarraInferior } from "../../lib/barra-inferior";
import { useSesion } from "../../lib/sesion";
import { COLORS, fmt, fmtDinero, Foto, MenuLateral, MENU_CLIENTE, ModalSheet, Button } from "../../lib/ui";
import { MONEDAS, monedaValida } from "../../lib/helpers";
import { syncOverdueNotifications } from "../../lib/push";

const { width } = Dimensions.get('window');

const KEY_MONEDA = "moneda_vista_cliente";

const ETIQUETA_MONEDA: Record<string, string> = {
  BS: "Bs",
  USD: "USD",
  EUR: "EUR",
  COP: "COP",
  CLP: "CLP",
};

const NOMBRE_MONEDA: Record<string, string> = {
  BS: "bolívares",
  USD: "dólares",
  EUR: "euros",
  COP: "pesos colombianos",
  CLP: "pesos chilenos",
};

export default function MiPrestamo() {
  const [menu, setMenu] = useState(false);
  const [modalNiveles, setModalNiveles] = useState(false);
  const [monedaVista, setMonedaVista] = useState<string | null>(null);
  const barra = useRef(new Animated.Value(1)).current;
  const { sesion } = useSesion();
  const clienteId = sesion?.rol === "cliente" ? sesion.clienteId : undefined;

  useEffect(() => {
    AsyncStorage.getItem(KEY_MONEDA)
      .then((v) => v && setMonedaVista(monedaValida(v)))
      .catch(() => {});
  }, []);

  const cambiarMoneda = (m: string) => {
    setMonedaVista(m);
    AsyncStorage.setItem(KEY_MONEDA, m).catch(() => {});
  };

  useEffect(() => {
    Animated.timing(barra, {
      toValue: menu ? 0 : 1,
      duration: menu ? 150 : 200,
      useNativeDriver: true,
    }).start();
  }, [menu, barra]);

  const perfil: any = useQuery(api.portalCliente.me, clienteId ? { clienteId } : "skip");
  const resumen: any = useQuery(api.portalCliente.resumen, clienteId ? { clienteId } : "skip");
  const calendario: any[] = useQuery(
    api.portalCliente.calendario,
    clienteId ? { clienteId } : "skip"
  ) || [];
  const estrellasData: any = useQuery(api.portalCliente.getEstrellas, clienteId ? { clienteId } : "skip");

  const porMoneda: Record<string, any> = resumen?.porMoneda || {};
  const conSaldo = MONEDAS.filter((m) => (Number(porMoneda[m]?.balance) || 0) > 0);
  const activa = monedaVista || conSaldo[0] || "BS";
  const grupo = porMoneda[activa] || { borrowed: 0, paid: 0, balance: 0, prestamos: 0 };

  useEffect(() => {
    if (resumen) {
      syncOverdueNotifications(resumen.overdue || 0);
    }
  }, [resumen?.overdue]);

  const pagos = calendario.filter((c) => monedaValida(c.moneda) === activa);

  const total = Number(grupo.borrowed) || 0;
  const pagado = Number(grupo.paid) || 0;
  const porcentaje = total > 0 ? Math.min(100, Math.round((pagado / total) * 100)) : 0;
  const proximo = pagos.find((c) => c.estado !== "pagado");
  const abonos = total > 0 ? pagos.filter((c) => c.estado === "pagado").length : 0;
  const otras = conSaldo.filter((m) => m !== activa);
  const estrellas = estrellasData?.estrellas ?? 0;
  const maxCuotas = estrellas >= 5 ? estrellas : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Encabezado y Tarjeta Principal con Gradiente Moderno */}
        <LinearGradient colors={['#0F172A', '#1E293B', '#0F172A']} style={styles.headerBackground}>
          <View style={styles.headerTop}>
            <TouchableOpacity style={styles.iconButton} onPress={() => setMenu(true)}>
              <Ionicons name="menu-outline" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerTitleBox}>
              <Text style={styles.headerSubtitle}>Bienvenido de vuelta</Text>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {perfil?.nombre || "Cliente"}
              </Text>
            </View>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.push("/cliente/perfil")}>
              <Foto uri={perfil?.fotoPerfil} size={40} borde />
            </TouchableOpacity>
          </View>

          {/* Tarjeta de Saldo Glassmorphism */}
          <LinearGradient colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.04)']} style={styles.balanceCard}>
            <View style={styles.balanceEncabezado}>
              <View style={styles.balanceCol}>
                <Text style={styles.balanceLabel}>Saldo pendiente</Text>
                <Text style={styles.balanceAmount} numberOfLines={1} adjustsFontSizeToFit>
                  {fmtDinero(Number(grupo.balance) || 0, ETIQUETA_MONEDA[activa] || activa)}
                </Text>
                <Text style={styles.balanceMoneda}>
                  {grupo.prestamos
                    ? NOMBRE_MONEDA[activa] || activa
                    : `Sin deuda en ${NOMBRE_MONEDA[activa] || activa}`}
                </Text>
              </View>
              <LinearGradient colors={['#10B981', '#059669']} style={styles.walletCirculo}>
                <Ionicons name="wallet-outline" size={24} color="#FFFFFF" />
              </LinearGradient>
            </View>

            {/* Selector de Monedas */}
            <View style={styles.monedaSeg}>
              {MONEDAS.map((m) => {
                const activo = m === activa;
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() => cambiarMoneda(m)}
                    style={[styles.monedaSegItem, activo && styles.monedaSegItemActivo]}
                  >
                    <Text style={[styles.monedaSegTexto, activo && styles.monedaSegTextoActivo]}>
                      {ETIQUETA_MONEDA[m] || m}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </LinearGradient>
        </LinearGradient>

        {/* Cuerpo del dashboard */}
        <View style={styles.bodyContainer}>
          
          {/* Deudas en otras monedas */}
          {otras.length > 0 && (
            <View style={styles.otrasBox}>
              <Text style={styles.otrasTitulo}>Otras monedas con deuda</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {otras.map((m) => (
                  <TouchableOpacity key={m} style={styles.otraItem} onPress={() => cambiarMoneda(m)}>
                    <View style={styles.otraBadge}><Text style={styles.otraBadgeText}>{ETIQUETA_MONEDA[m]}</Text></View>
                    <Text style={styles.otraValor}>{fmt(porMoneda[m].balance)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Progreso Circular o de Barra Mejorado */}
          <View style={styles.modernCard}>
            <View style={styles.progressHeader}>
              <View>
                <Text style={styles.cardTitle}>Progreso de pagos</Text>
                <Text style={styles.progressSub}>{abonos} de {pagos.length} pagos realizados</Text>
              </View>
              <View style={styles.percentBadge}>
                <Text style={styles.percentText}>{porcentaje}%</Text>
              </View>
            </View>
            <View style={styles.progressBarBackground}>
              <LinearGradient 
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} 
                colors={['#10B981', '#34D399']} 
                style={[styles.progressBarFill, { width: `${porcentaje}%` }]} 
              />
            </View>
          </View>

          {/* Estadísticas */}
          <View style={styles.statsRow}>
            <View style={[styles.modernCard, styles.statBoxHalf]}>
              <View style={[styles.statIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Ionicons name="calendar-outline" size={22} color="#F59E0B" />
              </View>
              <Text style={styles.statLabel}>Próximo pago</Text>
              <Text style={[styles.statValue, { color: '#F59E0B' }]}>
                {proximo ? fechaCorta(proximo.fechaVencimiento) : "Al día"}
              </Text>
            </View>

            <View style={[styles.modernCard, styles.statBoxHalf]}>
              <View style={[styles.statIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Ionicons name="checkmark-done-circle-outline" size={22} color="#10B981" />
              </View>
              <Text style={styles.statLabel}>Total pagado</Text>
              <Text style={styles.statValue}>
                {fmtDinero(pagado, ETIQUETA_MONEDA[activa] || activa)}
              </Text>
            </View>
          </View>


          {/* Gráfico de actividad de pagos */}
          <Text style={styles.sectionTitle}>Actividad de pagos</Text>
          <View style={styles.chartCard}>
            <LineChart
              data={{
                labels: pagos.slice(-6).map((_, i) => `P${i + 1}`).length > 0
                  ? pagos.slice(-6).map((_, i) => `P${i + 1}`)
                  : ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
                datasets: [{
                  data: pagos.slice(-6).map(p => Number(p.monto) || 0).length > 0
                    ? pagos.slice(-6).map(p => Math.max(Number(p.monto) || 0, 0))
                    : [0, 0, 0, 0, 0, 0],
                }],
              }}
              width={width - 72}
              height={160}
              chartConfig={{
                backgroundGradientFrom: '#FFFFFF',
                backgroundGradientTo: '#FFFFFF',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                labelColor: () => '#94A3B8',
                strokeWidth: 2,
                propsForDots: {
                  r: '4',
                  strokeWidth: '2',
                  stroke: '#10B981',
                  fill: '#FFFFFF',
                },
                propsForBackgroundLines: {
                  strokeDasharray: '',
                  stroke: '#F1F5F9',
                  strokeWidth: 1,
                },
              }}
              bezier
              style={{ borderRadius: 12, marginLeft: -8 }}
              withShadow={false}
              withInnerLines={true}
              withOuterLines={false}
            />
            <Text style={styles.chartFooter}>
              Últimos {Math.min(pagos.length, 6) || 6} pagos registrados
            </Text>
          </View>


          {/* Nivel de estrellas del cliente */}
          <Text style={styles.sectionTitle}>Mi nivel</Text>
          <TouchableOpacity activeOpacity={0.8} onPress={() => setModalNiveles(true)}>
            <View style={[styles.nivelCard, { marginBottom: 16 }]}>
              <View style={styles.nivelTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nivelTitulo}>
                    {estrellas === 0 ? 'Sin nivel aún' : `Nivel ${estrellas} ⭐`}
                  </Text>
                  <Text style={styles.nivelSub}>
                    {maxCuotas === 0
                      ? 'Alcanza 5 ⭐ para pagar en cuotas'
                      : `Hasta ${maxCuotas} cuotas por préstamo`}
                  </Text>
                </View>
                <View style={styles.nivelBadge}>
                  <Text style={styles.nivelBadgeTxt}>{estrellas} ⭐</Text>
                </View>
              </View>
              <View style={styles.estrellasRow}>
                {[1,2,3,4,5,6,7,8,9,10,11,12].map((n) => (
                  <Text key={n} style={[styles.estrella, n <= estrellas && styles.estrellaActiva]}>★</Text>
                ))}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <View style={styles.cuotasBadgesRow}>
                  {maxCuotas > 0 && [4, 8, 12].filter(c => c <= maxCuotas).map((c) => (
                    <View key={c} style={styles.cuotaBadge}>
                      <Text style={styles.cuotaBadgeTxt}>{c} cuotas</Text>
                    </View>
                  ))}
                </View>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>Toca para ver beneficios</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Acciones Rápidas */}
          <Text style={styles.sectionTitle}>Acciones rápidas</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/cliente/solicitar")}>
              <LinearGradient colors={['#1E293B', '#0F172A']} style={styles.actionGradient}>
                <Ionicons name="cash-outline" size={26} color="#34D399" />
                <Text style={styles.actionText}>Nuevo Préstamo</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/cliente/pagos")}>
              <LinearGradient colors={['#FFFFFF', '#F8FAFC']} style={styles.actionGradientLight}>
                <Ionicons name="receipt-outline" size={26} color="#0F172A" />
                <Text style={styles.actionTextDark}>Ver mis pagos</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Modal de Beneficios por Nivel */}
      <ModalSheet visible={modalNiveles} onClose={() => setModalNiveles(false)} title="Beneficios por nivel">
        <Text style={styles.modalNivelesIntro}>
          Acumula estrellas para obtener más plazo y poder pagar en cómodas cuotas. Las estrellas las asigna el administrador evaluando tu puntualidad e historial crediticio.
        </Text>
        
        <View style={styles.nivelItem}>
          <Text style={styles.nivelItemTitle}>Nivel Base (0 - 4 ⭐)</Text>
          <Text style={styles.nivelItemDesc}>• Préstamos en modalidad de pago único a 30 días.</Text>
        </View>

        <View style={styles.nivelItem}>
          <Text style={styles.nivelItemTitle}>Nivel Bronce (5 ⭐)</Text>
          <Text style={styles.nivelItemDesc}>• Puedes solicitar pagar en hasta <Text style={{fontWeight:'bold'}}>4 cuotas</Text>.</Text>
        </View>

        <View style={styles.nivelItem}>
          <Text style={styles.nivelItemTitle}>Nivel Plata (8 ⭐)</Text>
          <Text style={styles.nivelItemDesc}>• Puedes solicitar pagar en hasta <Text style={{fontWeight:'bold'}}>8 cuotas</Text>.</Text>
        </View>

        <View style={styles.nivelItem}>
          <Text style={styles.nivelItemTitle}>Nivel Oro (12 ⭐)</Text>
          <Text style={styles.nivelItemDesc}>• Puedes solicitar pagar en hasta <Text style={{fontWeight:'bold'}}>12 cuotas</Text>.</Text>
        </View>

        <Button title="Entendido" onPress={() => setModalNiveles(false)} style={{ marginTop: 10 }} />
      </ModalSheet>

      {/* Barra de navegación inferior (se oculta al abrir el menú) */}
      <Animated.View style={{ opacity: barra }}>
        <BarraInferior />
      </Animated.View>

      <MenuLateral
        visible={menu}
        onClose={() => setMenu(false)}
        activo="inicio"
        opciones={MENU_CLIENTE}
        onNavegar={(ruta) => router.push(ruta as any)}
      >
        <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.menuPerfil}>
          <Foto uri={perfil?.fotoPerfil} size={70} borde />
          <Text style={styles.menuNombre} numberOfLines={1}>
            {[perfil?.nombre, perfil?.apellido].filter(Boolean).join(" ") || "Cliente"}
          </Text>
          <Text style={styles.menuCorreo} numberOfLines={1}>
            {sesion?.rol === "cliente" ? sesion.email : ""}
          </Text>
        </LinearGradient>
      </MenuLateral>
    </SafeAreaView>
  );
}

function fechaCorta(iso: string) {
  const f = String(iso || "").slice(0, 10);
  if (!f) return "-";
  const [a, m, d] = f.split("-");
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${Number(d)} ${meses[Number(m) - 1] || m}`;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { paddingBottom: 160 },
  
  headerBackground: {
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 40,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    elevation: 10,
    shadowColor: '#0F172A',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconButton: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 22,
  },
  headerTitleBox: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 10,
  },
  headerSubtitle: {
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

  balanceCard: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  balanceEncabezado: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  balanceCol: {
    flex: 1,
    marginRight: 12,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  balanceAmount: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1,
  },
  balanceMoneda: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
  },
  walletCirculo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },

  monedaSeg: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 14,
    padding: 6,
    marginTop: 24,
  },
  monedaSegItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  monedaSegItemActivo: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  monedaSegTexto: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '700',
  },
  monedaSegTextoActivo: {
    color: '#FFFFFF',
  },

  bodyContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },

  otrasBox: {
    marginBottom: 24,
  },
  otrasTitulo: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  otraItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  otraBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 10,
  },
  otraBadgeText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '800',
  },
  otraValor: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },

  modernCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  progressSub: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
  },
  percentBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  percentText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '800',
  },
  progressBarBackground: {
    height: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  statBoxHalf: {
    flex: 1,
    padding: 16,
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  statIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },

  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    overflow: 'hidden',
  },
  chartFooter: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flex: 1,
    height: 120,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  actionGradient: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  actionGradientLight: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 12,
  },
  actionTextDark: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 12,
  },

  nivelCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#0F172A',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  nivelTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  nivelTitulo: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  nivelSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  nivelBadge: {
    backgroundColor: 'rgba(245,158,11,0.2)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginLeft: 12,
  },
  nivelBadgeTxt: {
    color: '#F59E0B',
    fontWeight: '900',
    fontSize: 16,
  },
  estrellasRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 12,
  },
  estrella: {
    fontSize: 22,
    color: 'rgba(255,255,255,0.12)',
  },
  estrellaActiva: {
    color: '#F59E0B',
  },
  cuotasBadgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  cuotaBadge: {
    backgroundColor: 'rgba(52,211,153,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  cuotaBadgeTxt: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
  },

  modalNivelesIntro: {
    fontSize: 14,
    color: COLORS.textoSuave,
    marginBottom: 20,
    lineHeight: 20,
  },
  nivelItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  nivelItemTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  nivelItemDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },

  mockTabBar: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    height: 70,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  mockTabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  mockTabTextActive: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  mockTabTextInactive: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },


  menuPerfil: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  menuNombre: { color: '#FFFFFF', fontWeight: '800', fontSize: 18, marginTop: 16 },
  menuCorreo: { color: '#94A3B8', fontSize: 13, marginTop: 4, fontWeight: '500' },
});

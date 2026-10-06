import { getDb } from "./sqlite";

// ─────────────────────────── Fechas ───────────────────────────
export const hoy = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const fechaISO = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const diasEntre = (a: string, b: string): number => {
  const x = new Date(a + "T00:00:00");
  const y = new Date(b + "T00:00:00");
  return Math.round((y.getTime() - x.getTime()) / 86400000);
};

export const sumarDias = (fecha: string, dias: number): string => {
  const d = new Date(fecha + "T00:00:00");
  d.setDate(d.getDate() + dias);
  return fechaISO(d);
};

// Hora local en formato 24h "HH:MM:SS" (auditoría y orden de registros).
export const hora = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

// Marca de tiempo ordenable: "YYYY-MM-DD HH:MM:SS".
export const ahora = (): string => `${hoy()} ${hora()}`;

// ─────────────────────── IDs locales ───────────────────────
export const nuevoId = (prefixo: string): string =>
  `${prefixo}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

// ─────────────────────── Config (settings) ───────────────────────
// Caché en memoria: `prestamoDetail` se llama una vez por préstamo y antes
// consultaba 2 ajustes por cada uno (N+1). La caché se invalida al guardar.
const configCache = new Map<string, string | number>();

export function limpiarCacheConfig(): void {
  configCache.clear();
}

export async function configGet(key: string, def: string | number = ""): Promise<string | number> {
  if (configCache.has(key)) return configCache.get(key)!;
  const db = await getDb();
  const row: any = await db.getFirstAsync("SELECT value FROM settings WHERE key = ?", key);
  const valor = !row || row.value === null || row.value === undefined ? def : row.value;
  configCache.set(key, valor);
  return valor;
}

export async function configSet(key: string, value: string | number | boolean): Promise<void> {
  const db = await getDb();
  const existing: any = await db.getFirstAsync("SELECT id FROM settings WHERE key = ?", key);
  const str = String(value);
  if (existing) {
    await db.runAsync("UPDATE settings SET value = ? WHERE key = ?", str, key);
  } else {
    await db.runAsync("INSERT INTO settings (id, key, value) VALUES (?, ?, ?)", nuevoId("cfg"), key, str);
  }
  configCache.set(key, str);
}

export async function configNum(key: string, def: number): Promise<number> {
  const v = await configGet(key, def);
  return Number(v) || 0;
}

// ─────────────────────── Hash de contraseñas ───────────────────────
function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}
export function sha256hex(input: string): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const msg = unescape(encodeURIComponent(input));
  const l = msg.length;
  const bitLen = l * 8;
  const ml = Math.ceil((l + 9) / 64) * 64;
  const data = new Uint8Array(ml);
  for (let i = 0; i < l; i++) data[i] = msg.charCodeAt(i);
  data[l] = 0x80;
  const dv = new DataView(data.buffer);
  dv.setUint32(ml - 4, bitLen >>> 0);
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Int32Array(64);
  for (let i = 0; i < ml; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + w[t]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }
  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return toHex(h0) + toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4) + toHex(h5) + toHex(h6) + toHex(h7);
}

export function hashPassword(pass: string): string {
  const salt = Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${salt}:${sha256hex(salt + pass)}`;
}

export function verifyPassword(pass: string, stored: string): boolean {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  return sha256hex(salt + pass) === hash;
}

// ─────────────────────── Notificaciones ───────────────────────
import { enviarCorreoAPI } from "./correos";

export async function addNotification(tipo: string, mensaje: string, refId?: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO notificaciones (id, tipo, mensaje, refId, leida, fecha) VALUES (?, ?, ?, ?, 0, ?)",
    nuevoId("not"),
    tipo,
    mensaje,
    refId || null,
    hoy()
  );

  // Enviar copia por correo al administrador sin bloquear la app
  enviarCorreoAPI(
    "agrogestsistema@gmail.com", 
    `Nueva Notificación: ${tipo.toUpperCase()}`, 
    `<h3>Tienes una nueva alerta en el sistema</h3>
     <p><strong>Tipo:</strong> ${tipo}</p>
     <p><strong>Detalle:</strong> ${mensaje}</p>
     <p><small>Este correo fue generado automáticamente por tu aplicación móvil.</small></p>`
  ).catch(console.error);
}

// ─────────────────────── Bitácora (auditoría) ───────────────────────
export async function addLog(accion: string, detalle: string, refId?: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO bitacora (id, fecha, hora, accion, detalle, refId) VALUES (?, ?, ?, ?, ?, ?)",
    nuevoId("bit"),
    hoy(),
    hora(),
    accion,
    detalle || null,
    refId || null
  );
}

// ─────────────────────── WhatsApp ───────────────────────
// Reemplaza {nombre}, {monto}, {vencimiento} y {negocio} en la plantilla.
export function mensajeWhatsApp(
  plantilla: string,
  datos: { nombre?: string; monto?: string; vencimiento?: string; negocio?: string }
): string {
  const base =
    plantilla ||
    "Hola {nombre}, te recordamos que tu pago de {monto} vence el {vencimiento}. Gracias.";
  return base
    .replace(/\{nombre\}/g, datos.nombre || "")
    .replace(/\{monto\}/g, datos.monto || "")
    .replace(/\{vencimiento\}/g, datos.vencimiento || "")
    .replace(/\{negocio\}/g, datos.negocio || "");
}

// Normaliza un teléfono para wa.me. Si ya trae código de país (12+ dígitos con
// prefijo válido) se respeta; si no, se antepone el del negocio.
export function telefonoWhatsApp(telefono?: string, prefijoPais = "58"): string {
  const bruto = (telefono || "").trim();
  if (!bruto) return "";
  const pais = (prefijoPais || "").replace(/[^\d]/g, "");
  let digitos = bruto.replace(/[^\d]/g, "");
  if (digitos.startsWith("00")) digitos = digitos.slice(2);
  if (bruto.startsWith("+")) return digitos;
  if (pais && digitos.startsWith(pais)) return digitos;
  const local = digitos.replace(/^0+/, "");
  return pais ? pais + local : local;
}

export const linkWhatsApp = (telefono?: string, texto?: string, prefijoPais = "58"): string =>
  `https://wa.me/${telefonoWhatsApp(telefono, prefijoPais)}?text=${encodeURIComponent(texto || "")}`;

// ─────────────────────── Cálculo de préstamos ───────────────────────
// Fórmula ÚNICA de la app. `tasaInteres` es el porcentaje TOTAL del préstamo:
// se aplica una sola vez sobre el capital y queda congelado en cada préstamo.
//   deudaTotal = monto × (1 + tasa/100)
//   saldo      = deudaTotal − pagos
//   mora       = solo después de los días de gracia: saldo × (tasaMora/100) × días + recargo fijo
export interface PrestamoDetalle {
  totalPagos: number;
  deudaTotal: number;
  saldo: number;
  estadoCalc: string;
  diasVencido: number;
  mora: number;
  totalAdeudado: number;
}

export type ParametrosCalculo = {
  tasaMora: number;
  recargo: number;
  diasGracia: number;
};

// Deuda total de un préstamo: capital + interés total del %.
export const deudaTotal = (monto: number, tasaInteres: number): number =>
  Math.round(monto * (1 + (tasaInteres || 0) / 100) * 100) / 100;

export function calcularPrestamo(
  monto: number,
  tasaInteres: number,
  totalPagos: number,
  fechaVencimiento: string | null | undefined,
  estado: string,
  hoyStr: string,
  p: ParametrosCalculo
): PrestamoDetalle {
  const redondear = (n: number) => Math.round(n * 100) / 100;
  const total = deudaTotal(monto, tasaInteres);
  const saldo = redondear(total - totalPagos);
  const vencido = !!fechaVencimiento && fechaVencimiento < hoyStr && saldo > 0;
  const estadoCalc =
    estado === "pagado" || saldo <= 0 ? "pagado" : vencido ? "atrasado" : "activo";
  const diasVencido = vencido ? diasEntre(fechaVencimiento as string, hoyStr) : 0;
  const diasCobro = Math.max(0, diasVencido - p.diasGracia);
  const mora =
    vencido && diasCobro > 0
      ? redondear(saldo * (p.tasaMora / 100) * diasCobro + p.recargo)
      : 0;
  return {
    totalPagos,
    deudaTotal: total,
    saldo,
    estadoCalc,
    diasVencido,
    mora,
    totalAdeudado: redondear(saldo + mora),
  };
}

// Parámetros de mora/recargo (con caché de ajustes, sin consultas por préstamo).
export async function parametrosCalculo(): Promise<ParametrosCalculo> {
  const tasaMora = await configNum("tasa_mora", 0);
  const recargo = await configNum("recargo_atraso", 0);
  const diasGracia = await configNum("dias_gracia", 3);
  return { tasaMora, recargo, diasGracia };
}

export async function prestamoDetail(row: any): Promise<any | null> {
  if (!row) return null;
  const db = await getDb();
  const pagos: any[] = await db.getAllAsync(
    "SELECT *, id AS _id FROM pagos WHERE prestamoId = ?",
    row._id || row.id
  );
  const totalPagos = pagos.reduce((a: number, p: any) => a + (p.monto || 0), 0);
  const parametros = await parametrosCalculo();
  return {
    ...row,
    ...calcularPrestamo(
      Number(row.monto) || 0,
      Number(row.tasaInteres) || 0,
      totalPagos,
      row.fechaVencimiento,
      row.estado,
      hoy(),
      parametros
    ),
  };
}

// Total pagado por préstamo para toda una lista, en una sola consulta.
export async function pagosTotalesPorPrestamo(ids: string[]): Promise<Record<string, number>> {
  if (!ids.length) return {};
  const db = await getDb();
  const marcas = ids.map(() => "?").join(",");
  const filas: any[] = await db.getAllAsync(
    `SELECT prestamoId, SUM(monto) AS total FROM pagos WHERE prestamoId IN (${marcas}) GROUP BY prestamoId`,
    ...ids
  );
  const out: Record<string, number> = {};
  for (const f of filas) out[f.prestamoId] = f.total || 0;
  return out;
}

// Enriquece una lista de préstamos con la misma fórmula de cálculo.
export async function detallesPrestamos(rows: any[]): Promise<any[]> {
  if (!rows.length) return [];
  const totales = await pagosTotalesPorPrestamo(rows.map((r) => r._id || r.id));
  const p = await parametrosCalculo();
  const hoyStr = hoy();
  return rows.map((r) => ({
    ...r,
    ...calcularPrestamo(
      Number(r.monto) || 0,
      Number(r.tasaInteres) || 0,
      totales[r._id || r.id] || 0,
      r.fechaVencimiento,
      r.estado,
      hoyStr,
      p
    ),
  }));
}

export const redondear = (n: number): number => Math.round(n * 100) / 100;

export const MONEDAS = ["BS", "USD", "EUR", "COP", "CLP"];
export const monedaValida = (m?: string): string =>
  m && MONEDAS.includes(m.toUpperCase()) ? m.toUpperCase() : "BS";

export const generarCodigo = (nombre: string, id: string): string => {
  const limpio = (nombre || "cli").toLowerCase().replace(/[^a-z0-9]/g, "");
  const corto = String(id || "").replace(/[^a-z0-9]/gi, "").slice(0, 6);
  return `REF-${limpio || "cli"}-${corto}`;
};
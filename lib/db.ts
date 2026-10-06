import { getDb } from "./sqlite";
import { hashPassword, hoy, nuevoId } from "./helpers";

const SCHEMA = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY NOT NULL,
  key TEXT NOT NULL UNIQUE,
  value TEXT
);

CREATE TABLE IF NOT EXISTS solicitudes (
  id TEXT PRIMARY KEY NOT NULL,
  codigoRef TEXT,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  cedula TEXT NOT NULL,
  edad INTEGER,
  fotoFront TEXT,
  fotoBack TEXT,
  fotoPerfil TEXT,
  lat REAL,
  lng REAL,
  ubicacion TEXT,
  referidoPor TEXT,
  referenciaCodigo TEXT,
  telefono TEXT,
  notas TEXT,
  correo TEXT,
  estado TEXT NOT NULL,
  motivoRechazo TEXT,
  bloqueado INTEGER NOT NULL DEFAULT 0,
  estrellas INTEGER NOT NULL DEFAULT 0,
  fechaCreacion TEXT NOT NULL,
  fechaProceso TEXT
);
CREATE INDEX IF NOT EXISTS idx_sol_cedula ON solicitudes(cedula);
CREATE INDEX IF NOT EXISTS idx_sol_estado ON solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_sol_codigoref ON solicitudes(codigoRef);

CREATE TABLE IF NOT EXISTS prestamos (
  id TEXT PRIMARY KEY NOT NULL,
  clienteId TEXT,
  nombre TEXT NOT NULL,
  cedula TEXT,
  telefono TEXT,
  monto REAL NOT NULL,
  tasaInteres REAL NOT NULL,
  fechaPrestamo TEXT NOT NULL,
  tiempo TEXT,
  fechaVencimiento TEXT,
  estado TEXT NOT NULL,
  notas TEXT,
  moneda TEXT NOT NULL,
  fechaCreacion TEXT NOT NULL,
  esCuotas INTEGER NOT NULL DEFAULT 0,
  numeroCuotas INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_pre_cliente ON prestamos(clienteId);
CREATE INDEX IF NOT EXISTS idx_pre_estado ON prestamos(estado);
CREATE INDEX IF NOT EXISTS idx_pre_venc ON prestamos(fechaVencimiento);

CREATE TABLE IF NOT EXISTS pagos (
  id TEXT PRIMARY KEY NOT NULL,
  prestamoId TEXT NOT NULL,
  monto REAL NOT NULL,
  fecha TEXT NOT NULL,
  notas TEXT
);
CREATE INDEX IF NOT EXISTS idx_pagos_pre ON pagos(prestamoId);

CREATE TABLE IF NOT EXISTS recordatorios (
  id TEXT PRIMARY KEY NOT NULL,
  prestamoId TEXT NOT NULL,
  canal TEXT NOT NULL,
  notas TEXT,
  fecha TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rec_pre ON recordatorios(prestamoId);

CREATE TABLE IF NOT EXISTS notificaciones (
  id TEXT PRIMARY KEY NOT NULL,
  tipo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  refId TEXT,
  leida INTEGER NOT NULL DEFAULT 0,
  fecha TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_not_estado ON notificaciones(leida);

CREATE TABLE IF NOT EXISTS solicitudesPrestamo (
  id TEXT PRIMARY KEY NOT NULL,
  clienteId TEXT NOT NULL,
  monto REAL NOT NULL,
  metodoPago TEXT NOT NULL,
  moneda TEXT NOT NULL,
  tasaInteres REAL NOT NULL,
  estado TEXT NOT NULL,
  motivoRechazo TEXT,
  fechaCreacion TEXT NOT NULL,
  fechaProceso TEXT,
  esCuotas INTEGER NOT NULL DEFAULT 0,
  numeroCuotas INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_sp_cliente ON solicitudesPrestamo(clienteId);
CREATE INDEX IF NOT EXISTS idx_sp_estado ON solicitudesPrestamo(estado);

CREATE TABLE IF NOT EXISTS pagosCliente (
  id TEXT PRIMARY KEY NOT NULL,
  clienteId TEXT NOT NULL,
  prestamoId TEXT NOT NULL,
  monto REAL NOT NULL,
  metodo TEXT NOT NULL,
  referencia TEXT,
  comprobante TEXT,
  estado TEXT NOT NULL,
  motivoRechazo TEXT,
  fechaPago TEXT NOT NULL,
  fechaCreacion TEXT NOT NULL,
  fechaProceso TEXT,
  pagoId TEXT
);
CREATE INDEX IF NOT EXISTS idx_pc_cliente ON pagosCliente(clienteId);
CREATE INDEX IF NOT EXISTS idx_pc_estado ON pagosCliente(estado);

CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  email TEXT,
  rol TEXT NOT NULL,
  perfilCompleto INTEGER NOT NULL DEFAULT 0,
  solicitudId TEXT,
  fechaCreacion TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usr_username ON usuarios(username);

CREATE TABLE IF NOT EXISTS intereses (
  id TEXT PRIMARY KEY NOT NULL,
  fecha TEXT NOT NULL,
  tasa REAL NOT NULL,
  nota TEXT,
  creadoEn TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_int_fecha ON intereses(fecha);

CREATE TABLE IF NOT EXISTS bitacora (
  id TEXT PRIMARY KEY NOT NULL,
  fecha TEXT NOT NULL,
  hora TEXT NOT NULL,
  accion TEXT NOT NULL,
  detalle TEXT,
  refId TEXT
);
CREATE INDEX IF NOT EXISTS idx_bit_fecha ON bitacora(fecha);
CREATE INDEX IF NOT EXISTS idx_bit_accion ON bitacora(accion);
`;

const DEFAULTS: Record<string, string | number> = {
  negocio_nombre: "Mi Negocio de Prestamos",
  whatsapp_numero: "",
  mensaje_recordatorio:
    "Hola {nombre}, te recordamos que tu pago de {monto} vence el {vencimiento}. Gracias.",
  moneda: "Bs.",
  tasa_interes: 10,
  tasa_mora: 0,
  recargo_atraso: 4,
  dias_gracia: 3,
  pais_wa: "58",
};

// Ajustes que ya no se usan: el acceso del administrador vive en la tabla
// `usuarios` (usuario + hash). Se limpian para no dejar dos fuentes de verdad.
const AJUSTES_LEGACY = ["admin_user", "admin_password"];

// Agrega columnas a tablas ya creadas en instalaciones anteriores.
async function migrar(db: Awaited<ReturnType<typeof getDb>>) {
  const cols = async (tabla: string): Promise<string[]> => {
    const info: any = await db.getAllAsync(`PRAGMA table_info(${tabla})`);
    return info.map((c: any) => c.name as string);
  };

  const usuarios = await cols("usuarios");
  if (!usuarios.includes("email")) {
    await db.execAsync("ALTER TABLE usuarios ADD COLUMN email TEXT");
  }
  // Los intereses antiguos guardaban solo la fecha; se completa con la hora
  // para que el orden "tasa vigente" sea determinista.
  await db.execAsync(
    "UPDATE intereses SET creadoEn = creadoEn || ' 00:00:00' WHERE creadoEn IS NOT NULL AND length(creadoEn) = 10"
  );
  await db.execAsync("CREATE INDEX IF NOT EXISTS idx_usr_email ON usuarios(email)");
  await db.execAsync(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_usr_email_unico ON usuarios(email COLLATE NOCASE) WHERE email IS NOT NULL"
  );

  // Migración: sistema de estrellas y cuotas
  const solCols = await cols("solicitudes");
  if (!solCols.includes("estrellas")) {
    await db.execAsync("ALTER TABLE solicitudes ADD COLUMN estrellas INTEGER NOT NULL DEFAULT 0");
  }
  const preCols = await cols("prestamos");
  if (!preCols.includes("esCuotas")) {
    await db.execAsync("ALTER TABLE prestamos ADD COLUMN esCuotas INTEGER NOT NULL DEFAULT 0");
  }
  if (!preCols.includes("numeroCuotas")) {
    await db.execAsync("ALTER TABLE prestamos ADD COLUMN numeroCuotas INTEGER NOT NULL DEFAULT 1");
  }
  const spCols = await cols("solicitudesPrestamo");
  if (!spCols.includes("esCuotas")) {
    await db.execAsync("ALTER TABLE solicitudesPrestamo ADD COLUMN esCuotas INTEGER NOT NULL DEFAULT 0");
  }
  if (!spCols.includes("numeroCuotas")) {
    await db.execAsync("ALTER TABLE solicitudesPrestamo ADD COLUMN numeroCuotas INTEGER NOT NULL DEFAULT 1");
  }
}

export async function initDb(): Promise<void> {
  const db = await getDb();
  await db.execAsync(SCHEMA);
  await migrar(db);

  for (const key of AJUSTES_LEGACY) {
    await db.runAsync("DELETE FROM settings WHERE key = ?", key);
  }

  const hoyStr = hoy();
  for (const [key, value] of Object.entries(DEFAULTS)) {
    await db.runAsync(
      "INSERT OR IGNORE INTO settings (id, key, value) VALUES (?, ?, ?)",
      nuevoId("cfg"),
      key,
      String(value)
    );
  }

  const admin: any = await db.getFirstAsync("SELECT id FROM usuarios WHERE username = ?", "admin");
  if (!admin) {
    await db.runAsync(
      "INSERT INTO usuarios (id, username, passwordHash, rol, perfilCompleto, solicitudId, fechaCreacion) VALUES (?, ?, ?, 'admin', 1, NULL, ?)",
      nuevoId("usr"),
      "admin",
      hashPassword("admin123"),
      hoyStr
    );
  } else {
    // Asegura que el usuario admin existente tenga rol de acceso al panel
    await db.runAsync("UPDATE usuarios SET rol = 'admin' WHERE username = 'admin'");
  }
}
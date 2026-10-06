import { useCallback, useEffect, useState } from "react";

import { getDb } from "./sqlite";
import {
  crearRespaldo,
  listarRespaldos,
  eliminarRespaldo,
} from "./respaldo";
import { initDb } from "./db";
import * as H from "./helpers";

// Id de documento local: cadena de texto arbitraria
export type Id<T extends string = string> = string;

// ───────────────────────────── Store reactivo ─────────────────────────────
type QueryDef = { key: string; run: (args?: any) => any };
type MutationDef = { key: string; run: (args?: any) => Promise<any> };

const cache = new Map<string, { value?: any; error?: any; version: number }>();
const listeners = new Map<string, Set<() => void>>();
let dbReady = false;
let dbInitPromise: Promise<void> | null = null;

async function ensureInit() {
  if (dbReady) return;
  if (!dbInitPromise) dbInitPromise = initDb();
  await dbInitPromise;
  dbReady = true;
}

function subscribe(key: string, fn: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) listeners.delete(key);
  };
}

function notifyAll() {
  for (const set of listeners.values()) {
    for (const fn of [...set]) fn();
  }
}

function qkey(def: QueryDef, args?: any): string | null {
  if (args === "skip") return null;
  return def.key + "|" + JSON.stringify(args === undefined ? {} : args);
}

export function useQuery(def: QueryDef, args?: any): any {
  const [, setTick] = useState(0);
  const key = qkey(def, args);

  useEffect(() => {
    if (!key) return;
    const k: string = key;
    let activo = true;
    async function refrescar() {
      await ensureInit();
      if (!activo) return;
      try {
        const valor = await def.run(args);
        if (!activo) return;
        cache.set(k, { value: valor, version: (cache.get(k)?.version || 0) + 1 });
      } catch (e) {
        if (!activo) return;
        cache.set(k, { value: undefined, error: e, version: (cache.get(k)?.version || 0) + 1 });
      }
      setTick((t) => t + 1);
    }
    const desuscribir = subscribe(k, refrescar);
    refrescar();
    return () => {
      activo = false;
      desuscribir();
    };
  }, [key]);

  if (!key) return undefined;
  return cache.get(key)?.value;
}

export function useMutation(def: MutationDef) {
  return useCallback(
    async (args?: any) => {
      await ensureInit();
      const r = await def.run(args);
      cache.clear();
      notifyAll();
      return r;
    },
    [def]
  );
}

// ───────────────────────────── Utilidades SQL ─────────────────────────────
const SELECT_SOL = "SELECT *, id AS _id FROM solicitudes";
const SELECT_PRE = "SELECT *, id AS _id FROM prestamos";

const METODOS_PAGO_CLIENTE: Record<string, string> = { transferencia: "Transferencia", efectivo: "Efectivo" };
const METODOS_SOLICITUD: Record<string, string> = { pago_movil: "Pago Móvil", zelle: "Zelle", efectivo: "Efectivo" };
const MONEDAS_MAP: Record<string, string> = {
  bs: "Bolívares (Bs.)",
  cop: "Pesos colombianos (COP)",
  clp: "Pesos chilenos (CLP)",
  usd: "Dólares (USD)",
  eur: "Euros (EUR)",
};
const MONEDA_CLI: Record<string, string> = { bs: "BS", cop: "COP", clp: "CLP", usd: "USD", eur: "EUR" };

const norm = (p?: string | null) => (p || "").replace(/[\s\-()]/g, "");

// ───────────────────────────── auth ─────────────────────────────
const normEmail = (e?: string | null) => (e || "").trim().toLowerCase();

// Comprueba disponibilidad de usuario y correo (para validar mientras escribe).
const disponibilidad = async (args: { username?: string; email?: string }) => {
  const db = await getDb();
  const usuario = (args.username || "").trim();
  const correo = normEmail(args.email);
  let usuarioLibre = true;
  let correoLibre = true;
  if (usuario) {
    const u: any = await db.getFirstAsync("SELECT id FROM usuarios WHERE username = ?", usuario);
    if (u) usuarioLibre = false;
  }
  if (correo) {
    const c: any = await db.getFirstAsync("SELECT id FROM usuarios WHERE email = ?", correo);
    if (c) correoLibre = false;
  }
  return { usuarioLibre, correoLibre };
};

const login = async (args: { username: string; password: string }) => {
  const uname = (args.username || "").trim();
  const db = await getDb();
  const user: any = await db.getFirstAsync(
    "SELECT *, id AS _id FROM usuarios WHERE username = ?",
    uname
  );
  if (!user || !H.verifyPassword(args.password, user.passwordHash)) {
    throw new Error("Usuario o contraseña incorrectos");
  }
  let clienteId: string | null = null;
  let nombre = "";
  let bloqueado = false;
  if (user.rol === "cliente" && user.solicitudId) {
    const sol: any = await db.getFirstAsync(
      "SELECT id, nombre, apellido, bloqueado FROM solicitudes WHERE id = ?",
      user.solicitudId
    );
    if (sol) {
      clienteId = sol.id;
      nombre = `${sol.nombre} ${sol.apellido}`.trim();
      bloqueado = !!sol.bloqueado;
    }
  }
  return {
    ok: true,
    username: user.username,
    email: user.email || "",
    rol: user.rol,
    userId: user._id,
    perfilCompleto: !!user.perfilCompleto,
    clienteId,
    nombre,
    bloqueado,
  };
};

const registroUsuario = async (args: { username: string; password: string; email: string }) => {
  const uname = (args.username || "").trim();
  const correo = normEmail(args.email);
  if (uname.length < 3) throw new Error("El usuario debe tener al menos 3 caracteres");
  if ((args.password || "").length < 4) throw new Error("La contraseña debe tener al menos 4 caracteres");
  if (!correo) throw new Error("El correo es obligatorio");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) {
    throw new Error("El correo no tiene un formato válido");
  }
  const db = await getDb();
  const existU: any = await db.getFirstAsync("SELECT id FROM usuarios WHERE username = ?", uname);
  if (existU) throw new Error("Ese nombre de usuario ya está registrado. Elige otro.");
  const existE: any = await db.getFirstAsync("SELECT id FROM usuarios WHERE email = ?", correo);
  if (existE) throw new Error("Ese correo ya está registrado. Usa otro correo.");

  const id = H.nuevoId("usr");
  await db.runAsync(
    "INSERT INTO usuarios (id, username, passwordHash, email, rol, perfilCompleto, solicitudId, fechaCreacion) VALUES (?, ?, ?, ?, 'cliente', 0, NULL, ?)",
    id,
    uname,
    H.hashPassword(args.password),
    correo,
    H.hoy()
  );
  await H.addNotification("cliente", `Nuevo usuario registrado: ${uname} (pendiente de completar perfil)`, id);
  return { ok: true, userId: id };
};

// Usuario administrador en sesión: la tabla `usuarios` es la única fuente
// de verdad (antes se comparaba contra el ajuste `admin_user`).
const usuarioAdmin = async (userId?: string | null): Promise<any> => {
  const db = await getDb();
  if (userId) {
    const porId: any = await db.getFirstAsync(
      "SELECT *, id AS _id FROM usuarios WHERE id = ? AND rol = 'admin'",
      userId
    );
    if (porId) return porId;
  }
  return db.getFirstAsync("SELECT *, id AS _id FROM usuarios WHERE rol = 'admin' ORDER BY fechaCreacion LIMIT 1");
};

const adminActual = async (args?: { userId?: string }) => {
  const admin = await usuarioAdmin(args?.userId);
  return {
    username: admin?.username || "admin",
    email: admin?.email || "",
    existe: !!admin,
  };
};

const cambiarPassword = async (args: {
  passwordActual: string;
  passwordNueva: string;
  rol?: string;
  userId?: string;
}) => {
  const db = await getDb();
  const user = await usuarioAdmin(args.userId);
  if (!user) throw new Error("Usuario admin no encontrado");
  if (!H.verifyPassword(args.passwordActual, user.passwordHash)) {
    throw new Error("Contraseña actual incorrecta");
  }
  if ((args.passwordNueva || "").length < 4) {
    throw new Error("La nueva contraseña debe tener al menos 4 caracteres");
  }
  await db.runAsync("UPDATE usuarios SET passwordHash = ? WHERE id = ?", H.hashPassword(args.passwordNueva), user.id);
  await H.addLog("password_cambio", `Contraseña actualizada para ${user.username}`, user.id);
  return { ok: true };
};

// Renombra el usuario admin y/o su clave. El ajuste `admin_user` ya no existe,
// así que esto es lo único que cambia realmente el acceso al panel.
const cambiarUsuarioAdmin = async (args: {
  usuarioNuevo?: string;
  passwordActual: string;
  passwordNueva?: string;
  userId?: string;
}) => {
  const db = await getDb();
  const user = await usuarioAdmin(args.userId);
  if (!user) throw new Error("Usuario admin no encontrado");
  if (!H.verifyPassword(args.passwordActual, user.passwordHash)) {
    throw new Error("Contraseña actual incorrecta");
  }
  const nuevo = (args.usuarioNuevo || "").trim();
  if (nuevo) {
    if (nuevo.length < 3) throw new Error("El usuario debe tener al menos 3 caracteres");
    if (nuevo.toLowerCase() === "admin" && user.username.toLowerCase() !== "admin") {
      throw new Error("Ese nombre de usuario está reservado");
    }
    const existe: any = await db.getFirstAsync(
      "SELECT id FROM usuarios WHERE username = ? AND id <> ?",
      nuevo,
      user.id
    );
    if (existe) throw new Error("Ese nombre de usuario ya está registrado");
    await db.runAsync("UPDATE usuarios SET username = ? WHERE id = ?", nuevo, user.id);
    await H.addLog("usuario_cambio", `Usuario admin renombrado: ${user.username} → ${nuevo}`, user.id);
    user.username = nuevo;
  }
  if (args.passwordNueva) {
    if (args.passwordNueva.length < 4) {
      throw new Error("La nueva contraseña debe tener al menos 4 caracteres");
    }
    await db.runAsync(
      "UPDATE usuarios SET passwordHash = ? WHERE id = ?",
      H.hashPassword(args.passwordNueva),
      user.id
    );
    await H.addLog("password_cambio", `Contraseña actualizada para ${user.username}`, user.id);
  }
  return { ok: true, username: user.username };
};

// ───────────────────────────── clientes ─────────────────────────────
const listarClientes = async (args?: { q?: string; estado?: string; bloqueado?: boolean }) => {
  const estado = args?.estado || "aprobado";
  const db = await getDb();
  let rows: any[] = await db.getAllAsync(
    `${SELECT_SOL} WHERE estado = ? ORDER BY fechaCreacion DESC`,
    estado
  );
  if (args?.q) {
    const q = args.q.toLowerCase();
    rows = rows.filter(
      (c) =>
        (c.nombre || "").toLowerCase().includes(q) ||
        (c.apellido || "").toLowerCase().includes(q) ||
        (c.cedula || "").toLowerCase().includes(q) ||
        (c.telefono || "").toLowerCase().includes(q)
    );
  }
  if (args?.bloqueado !== undefined) {
    rows = rows.filter((c) => (c.bloqueado ? true : false) === args!.bloqueado);
  }
  if (!rows.length) return [];
  // Antes hacía 2 consultas por cliente (prestamos + usuario). Ahora 2 en total.
  const ids = rows.map((c) => c._id);
  const marcas = ids.map(() => "?").join(",");
  const prestamos: any[] = await db.getAllAsync(
    `SELECT clienteId, COUNT(*) AS n, SUM(monto) AS total FROM prestamos
     WHERE clienteId IN (${marcas}) GROUP BY clienteId`,
    ...ids
  );
  const usuarios: any[] = await db.getAllAsync(
    `SELECT solicitudId, username, email, perfilCompleto FROM usuarios
     WHERE solicitudId IN (${marcas})`,
    ...ids
  );
  const porCliente = new Map(prestamos.map((p) => [p.clienteId, p]));
  const porUsuario = new Map(usuarios.map((u) => [u.solicitudId, u]));
  return rows.map((c) => {
    const usuario = porUsuario.get(c._id);
    const p = porCliente.get(c._id);
    return {
      ...c,
      username: usuario?.username || null,
      email: usuario?.email || c.correo || null,
      perfilCompleto: usuario ? !!usuario.perfilCompleto : true,
      total_prestado: p?.total || 0,
      n_prestamos: p?.n || 0,
    };
  });
};

const clientesList = async (args?: { q?: string; estado?: string; bloqueado?: boolean }) =>
  listarClientes(args);

// Listado por páginas: los listados largos no cargan hundreds de filas de golpe.
const clientesPage = async (args?: { q?: string; estado?: string; bloqueado?: boolean; limite?: number; offset?: number }) => {
  const todos = await listarClientes(args);
  const limite = Math.max(1, Math.min(200, Number(args?.limite) || 20));
  const offset = Math.max(0, Number(args?.offset) || 0);
  const items = todos.slice(offset, offset + limite);
  return { items, total: todos.length, hayMas: offset + items.length < todos.length };
};

const estadoCuenta = async (args: { id: string }) => {
  const db = await getDb();
  const c: any = await db.getFirstAsync(`${SELECT_SOL} WHERE id = ?`, args.id);
  if (!c) throw new Error("El cliente no existe");
  const prestamos: any[] = await db.getAllAsync(
    `${SELECT_PRE} WHERE clienteId = ? ORDER BY fechaPrestamo DESC`,
    args.id
  );
  const out: any[] = [];
  for (const p of prestamos) {
    const det = await H.prestamoDetail(p);
    if (!det) continue;
    const pagos: any[] = await db.getAllAsync("SELECT *, id AS _id FROM pagos WHERE prestamoId = ?", p._id);
    pagos.sort((a, b) => (b.fecha + b._id).localeCompare(a.fecha + a._id));
    out.push({ ...det, pagos });
  }
  const total_prestado = out.reduce((a, p) => a + p.monto, 0);
  const total_pagado = out.reduce((a, p) => a + p.totalPagos, 0);
  const total_mora = out.reduce((a, p) => a + (p.mora || 0), 0);
  const pagos = out.flatMap((p) =>
    p.pagos.map((x: any) => ({ ...x, nombre: p.nombre, moneda: p.moneda }))
  );
  const usuario: any = c._id
    ? await db.getFirstAsync(
        "SELECT username, email, perfilCompleto FROM usuarios WHERE solicitudId = ?",
        c._id
      )
    : null;
  return {
    cliente: {
      id: c._id,
      nombre: c.nombre,
      apellido: c.apellido,
      cedula: c.cedula,
      telefono: c.telefono,
      correo: c.correo,
      edad: c.edad,
      ubicacion: c.ubicacion,
      lat: c.lat,
      lng: c.lng,
      fotoFront: c.fotoFront,
      fotoBack: c.fotoBack,
      fotoPerfil: c.fotoPerfil,
      codigoRef: c.codigoRef,
      estado: c.estado,
      username: usuario?.username || null,
      email: usuario?.email || c.correo || null,
      perfilCompleto: usuario ? !!usuario.perfilCompleto : true,
      fecha_creacion: c.fechaCreacion,
    },
    bloqueado: c.bloqueado ? true : false,
    resumen: {
      prestamos: out.length,
      total_prestado,
      total_pagado,
      total_mora,
    },
    total_prestado,
    total_pagado,
    prestamos: out,
    pagos,
  };
};

const crearCliente = async (args: {
  nombre: string;
  apellido: string;
  cedula: string;
  edad?: number;
  telefono?: string;
  ubicacion?: string;
  notas?: string;
  correo?: string;
  lat?: number;
  lng?: number;
}) => {
  const nombre = (args.nombre || "").trim();
  const apellido = (args.apellido || "").trim();
  const cedula = (args.cedula || "").trim().replace(/\s/g, "");
  if (!nombre || !apellido || !cedula) throw new Error("Nombre, apellido y cédula son obligatorios");
  const db = await getDb();
  const exist: any = await db.getFirstAsync("SELECT estado FROM solicitudes WHERE cedula = ?", cedula);
  if (exist) throw new Error(`Esa cédula ya está registrada (${exist.estado}).`);
  const id = H.nuevoId("sol");
  await db.runAsync(
    `INSERT INTO solicitudes (id, codigoRef, nombre, apellido, cedula, edad, telefono, ubicacion, notas, correo, lat, lng, estado, bloqueado, fechaCreacion, fechaProceso)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aprobado', 0, ?, ?)`,
    id,
    nombre,
    apellido,
    cedula,
    args.edad ?? null,
    args.telefono || null,
    args.ubicacion || null,
    args.notas || null,
    args.correo || null,
    args.lat ?? null,
    args.lng ?? null,
    H.hoy(),
    H.hoy()
  );
  await db.runAsync("UPDATE solicitudes SET codigoRef = ? WHERE id = ?", H.generarCodigo(nombre, id), id);
  await H.addNotification("cliente", `Cliente registrado manualmente: ${nombre} ${apellido} (cédula ${cedula})`, id);
  return { ok: true, id };
};

const toggleBloqueo = async (args: { id: string; bloquear?: boolean }) => {
  const db = await getDb();
  const c: any = await db.getFirstAsync(`${SELECT_SOL} WHERE id = ?`, args.id);
  if (!c) throw new Error("No existe");
  const deseado = args.bloquear !== undefined ? !!args.bloquear : !(c.bloqueado ? true : false);
  await db.runAsync("UPDATE solicitudes SET bloqueado = ? WHERE id = ?", deseado ? 1 : 0, args.id);
  await H.addNotification(
    "cliente",
    `${deseado ? "Bloqueado" : "Desbloqueado"}: ${c.nombre} ${c.apellido}`,
    args.id
  );
  return { ok: true, bloqueado: deseado };
};

// ───────────────────────────── prestamos ─────────────────────────────
const listarPrestamos = async (args?: { q?: string; estado?: string }) => {
  const db = await getDb();
  let rows: any[] = await db.getAllAsync(`${SELECT_PRE} ORDER BY fechaPrestamo DESC`);
  if (args?.q) {
    const q = args.q.toLowerCase();
    rows = rows.filter(
      (p) =>
        (p.nombre || "").toLowerCase().includes(q) ||
        (p.cedula || "").toLowerCase().includes(q) ||
        (p.telefono || "").toLowerCase().includes(q)
    );
  }
  // Una sola consulta de pagos para todos los préstamos (antes 1 por préstamo).
  const out = await H.detallesPrestamos(rows);
  return args?.estado ? out.filter((p) => p.estadoCalc === args.estado) : out;
};

const prestamosList = async (args?: { q?: string; estado?: string }) => listarPrestamos(args);

// Listado por páginas (cargar más) para no traer toda la cartera de golpe.
const prestamosPage = async (args?: {
  q?: string;
  estado?: string;
  limite?: number;
  offset?: number;
}) => {
  const todos = await listarPrestamos(args);
  const limite = Math.max(1, Math.min(200, Number(args?.limite) || 20));
  const offset = Math.max(0, Number(args?.offset) || 0);
  const items = todos.slice(offset, offset + limite);
  return { items, total: todos.length, hayMas: offset + items.length < todos.length };
};

const prestamoGet = async (args: { id: string }) => {
  const db = await getDb();
  const row: any = await db.getFirstAsync(`${SELECT_PRE} WHERE id = ?`, args.id);
  if (!row) throw new Error("No existe");
  const det = await H.prestamoDetail(row);
  const pagos: any[] = await db.getAllAsync("SELECT *, id AS _id FROM pagos WHERE prestamoId = ?", args.id);
  pagos.sort((a, b) => (b.fecha + b._id).localeCompare(a.fecha + a._id));
  return { ...det, pagos };
};

const crearPrestamo = async (args: {
  clienteId?: string;
  nombre?: string;
  cedula?: string;
  telefono?: string;
  monto: number;
  tasaInteres?: number;
  fechaPrestamo?: string;
  tiempo?: string;
  dias?: number;
  fechaVencimiento?: string;
  notas?: string;
  moneda?: string;
}) => {
  const db = await getDb();
  let nombre = "";
  let cedula: string | undefined = args.cedula || undefined;
  let telefono: string | undefined = args.telefono || undefined;
  let clienteId: string | undefined = undefined;

  if (args.clienteId) {
    const cliente: any = await db.getFirstAsync(`${SELECT_SOL} WHERE id = ?`, args.clienteId);
    if (!cliente) throw new Error("Cliente no encontrado");
    if (cliente.estado !== "aprobado") throw new Error("El cliente no está aprobado");
    if (cliente.bloqueado) {
      throw new Error(`${cliente.nombre} ${cliente.apellido} está BLOQUEADO y no puede recibir préstamos`);
    }
    clienteId = cliente._id;
    nombre = `${cliente.nombre} ${cliente.apellido}`.trim();
    cedula = cliente.cedula || undefined;
    telefono = cliente.telefono || undefined;
  } else {
    nombre = (args.nombre || "").trim();
  }
  if (!nombre) throw new Error("El nombre es obligatorio");
  if (!args.monto || args.monto <= 0) throw new Error("Monto inválido");

  const fechaPrestamo = args.fechaPrestamo || H.hoy();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaPrestamo)) throw new Error("Fecha de préstamo inválida");
  if (args.dias !== undefined && args.dias !== null && Number(args.dias) <= 0) {
    throw new Error("El plazo en días debe ser mayor que 0");
  }
  const venc =
    args.fechaVencimiento || (args.dias && args.dias > 0 ? H.sumarDias(fechaPrestamo, args.dias) : fechaPrestamo);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(venc)) throw new Error("Fecha de vencimiento inválida");
  if (venc < fechaPrestamo) {
    throw new Error("El vencimiento no puede ser anterior a la fecha del préstamo");
  }
  const moneda = H.monedaValida(args.moneda);

  // Si no se indica tasa se usa la vigente del día (pantalla Interés).
  const tasaEnviada = Number(args.tasaInteres);
  const tasa = Number.isFinite(tasaEnviada) ? tasaEnviada : (await tasaVigente()).tasa;
  if (tasa < 0 || tasa > 1000) throw new Error("La tasa de interés no es válida");

  const id = H.nuevoId("pre");
  await db.runAsync(
    `INSERT INTO prestamos (id, clienteId, nombre, cedula, telefono, monto, tasaInteres, fechaPrestamo, tiempo, fechaVencimiento, estado, notas, moneda, fechaCreacion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'activo', ?, ?, ?)`,
    id,
    clienteId || null,
    nombre,
    cedula || null,
    telefono || null,
    args.monto,
    tasa,
    fechaPrestamo,
    args.tiempo || null,
    venc,
    args.notas || null,
    moneda,
    H.hoy()
  );
  await H.addNotification("nuevo_prestamo", `Nuevo préstamo a ${nombre} por ${moneda} ${H.redondear(args.monto)}`, id);
  await H.addLog(
    "prestamo_creado",
    `Préstamo por ${moneda} ${H.redondear(args.monto)} a ${nombre} · tasa ${tasa}% · vence ${venc}`,
    id
  );
  return { ok: true, id };
};

const updatePrestamo = async (args: {
  id: string;
  nombre?: string;
  cedula?: string;
  telefono?: string;
  monto?: number;
  tasaInteres?: number;
  fechaPrestamo?: string;
  tiempo?: string;
  fechaVencimiento?: string;
  estado?: string;
  notas?: string;
  moneda?: string;
}) => {
  const db = await getDb();
  const row: any = await db.getFirstAsync("SELECT * FROM prestamos WHERE id = ?", args.id);
  if (!row) throw new Error("No existe");
  if (args.monto !== undefined && (!(args.monto > 0))) throw new Error("Monto inválido");
  if (args.tasaInteres !== undefined && (args.tasaInteres < 0 || args.tasaInteres > 1000)) {
    throw new Error("La tasa de interés no es válida");
  }
  const fechaPrestamo = args.fechaPrestamo ?? row.fechaPrestamo;
  const venc = args.fechaVencimiento ?? row.fechaVencimiento;
  if (fechaPrestamo && venc && venc < fechaPrestamo) {
    throw new Error("El vencimiento no puede ser anterior a la fecha del préstamo");
  }
  const up: [string, any][] = [];
  if (args.nombre !== undefined) up.push(["nombre", args.nombre]);
  if (args.cedula !== undefined) up.push(["cedula", args.cedula || null]);
  if (args.telefono !== undefined) up.push(["telefono", args.telefono || null]);
  if (args.monto !== undefined) up.push(["monto", args.monto]);
  if (args.tasaInteres !== undefined) up.push(["tasaInteres", args.tasaInteres]);
  if (args.fechaPrestamo !== undefined) up.push(["fechaPrestamo", args.fechaPrestamo]);
  if (args.tiempo !== undefined) up.push(["tiempo", args.tiempo || null]);
  if (args.fechaVencimiento !== undefined) up.push(["fechaVencimiento", args.fechaVencimiento || null]);
  if (args.estado !== undefined) up.push(["estado", args.estado]);
  if (args.notas !== undefined) up.push(["notas", args.notas || null]);
  if (args.moneda !== undefined) up.push(["moneda", H.monedaValida(args.moneda)]);
  if (up.length) {
    const sets = up.map(([col]) => `${col} = ?`).join(", ");
    await db.runAsync(`UPDATE prestamos SET ${sets} WHERE id = ?`, ...up.map(([, v]) => v), args.id);
  }
  if (up.length) {
    const campos = up.map(([c]) => c).join(", ");
    await H.addLog("prestamo_editado", `Préstamo ${row.nombre || args.id} · campos: ${campos}`, args.id);
  }
  return { ok: true };
};

const eliminarPrestamo = async (args: { id: string }) => {
  const db = await getDb();
  const row: any = await db.getFirstAsync("SELECT nombre, moneda, monto FROM prestamos WHERE id = ?", args.id);
  await db.runAsync("DELETE FROM pagos WHERE prestamoId = ?", args.id);
  await db.runAsync("DELETE FROM recordatorios WHERE prestamoId = ?", args.id);
  await db.runAsync("DELETE FROM prestamos WHERE id = ?", args.id);
  await H.addLog(
    "prestamo_eliminado",
    `Préstamo eliminado${row ? `: ${row.nombre} (${row.moneda} ${row.monto})` : ""}`,
    args.id
  );
  return { ok: true };
};

const registrarPago = async (args: {
  prestamoId: string;
  monto: number;
  fecha?: string;
  notas?: string;
  condonacion?: boolean;
}) => {
  if (!args.monto || args.monto <= 0) throw new Error("Monto de pago inválido");
  const db = await getDb();
  const row: any = await db.getFirstAsync(`${SELECT_PRE} WHERE id = ?`, args.prestamoId);
  if (!row) throw new Error("Préstamo no encontrado");
  const detPrevio = await H.prestamoDetail(row);
  if (detPrevio && detPrevio.saldo <= 0) {
    throw new Error("Este préstamo ya está saldado");
  }
  if (detPrevio && args.monto > detPrevio.saldo) {
    throw new Error(
      `El pago (${H.redondear(args.monto)}) supera el saldo pendiente (${H.redondear(detPrevio.saldo)})`
    );
  }
  const fecha = args.fecha || H.hoy();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error("Fecha de pago inválida");
  const id = H.nuevoId("pag");
  await db.runAsync(
    "INSERT INTO pagos (id, prestamoId, monto, fecha, notas) VALUES (?, ?, ?, ?, ?)",
    id,
    args.prestamoId,
    args.monto,
    fecha,
    args.condonacion ? `Condonación · ${args.notas || "saldo perdonado"}` : args.notas || null
  );
  const det = await H.prestamoDetail(row);
  const nuevoEstado =
    det && det.saldo <= 0 ? "pagado" : det && det.estadoCalc === "atrasado" ? "atrasado" : "activo";
  await db.runAsync("UPDATE prestamos SET estado = ? WHERE id = ?", nuevoEstado, args.prestamoId);
  await H.addNotification("pago", `Pago registrado ${args.monto.toLocaleString()} para ${row.nombre}`, id);
  await H.addLog(
    args.condonacion ? "pago_condonado" : "pago_registrado",
    `${args.condonacion ? "Condonación" : "Pago"} de ${row.moneda} ${H.redondear(args.monto)} · ${row.nombre} · saldo ${det ? H.redondear(det.saldo) : "?"}`,
    id
  );
  return { ok: true, id, saldo: det ? det.saldo : null };
};

// Prórroga: mueve el vencimiento. Se valida que el préstamo siga con saldo.
const renovarPrestamo = async (args: { id: string; dias: number; notas?: string }) => {
  const dias = Math.round(Number(args.dias));
  if (!Number.isFinite(dias) || dias <= 0) throw new Error("Indica cuántos días se prorrogan");
  const db = await getDb();
  const row: any = await db.getFirstAsync(`${SELECT_PRE} WHERE id = ?`, args.id);
  if (!row) throw new Error("Préstamo no encontrado");
  const det = await H.prestamoDetail(row);
  if (det && det.saldo <= 0) throw new Error("El préstamo está saldado, no necesita renovación");
  const base = row.fechaVencimiento && row.fechaVencimiento > H.hoy() ? row.fechaVencimiento : H.hoy();
  const nuevoVenc = H.sumarDias(base, dias);
  await db.runAsync("UPDATE prestamos SET fechaVencimiento = ?, estado = 'activo' WHERE id = ?", nuevoVenc, args.id);
  const nota = ` · ${(args.notas || "").trim()}`.trim();
  await db.runAsync(
    "UPDATE prestamos SET notas = COALESCE(notas, '') || ? WHERE id = ?",
    `\n[Renovación ${H.hoy()}] +${dias} días → ${nuevoVenc}${nota}`,
    args.id
  );
  await H.addLog("prestamo_renovado", `Renovación de ${dias} días para ${row.nombre} → vence ${nuevoVenc}`, args.id);
  return { ok: true, fechaVencimiento: nuevoVenc };
};

const eliminarPago = async (args: { id: string }) => {
  const db = await getDb();
  const pago: any = await db.getFirstAsync("SELECT * FROM pagos WHERE id = ?", args.id);
  if (!pago) throw new Error("No existe");
  await db.runAsync("DELETE FROM pagos WHERE id = ?", args.id);
  const row: any = await db.getFirstAsync(`${SELECT_PRE} WHERE id = ?`, pago.prestamoId);
  if (row) {
    const det = await H.prestamoDetail(row);
    const estado = det && det.saldo <= 0 ? "pagado" : det ? det.estadoCalc : row.estado;
    await db.runAsync("UPDATE prestamos SET estado = ? WHERE id = ?", estado, row._id);
    await H.addLog(
      "pago_eliminado",
      `Pago de ${H.redondear(pago.monto)} eliminado · ${row.nombre}${pago.notas ? ` · ${pago.notas}` : ""}`,
      args.id
    );
  }
  return { ok: true };
};

// ───────────────────────────── solicitudes ─────────────────────────────
const solicitudesPendientes = async () => {
  const db = await getDb();
  return await db.getAllAsync(`${SELECT_SOL} WHERE estado = 'pendiente' ORDER BY fechaCreacion DESC`);
};

const solicitudesRechazados = async () => {
  const db = await getDb();
  const rows: any[] = await db.getAllAsync(`${SELECT_SOL} WHERE estado = 'rechazado'`);
  return rows.sort((a, b) => (b.fechaProceso || "").localeCompare(a.fechaProceso || ""));
};

const aprobarSolicitud = async (args: { id: string }) => {
  const db = await getDb();
  const row: any = await db.getFirstAsync("SELECT * FROM solicitudes WHERE id = ?", args.id);
  if (!row) throw new Error("No existe");
  await db.runAsync("UPDATE solicitudes SET estado = 'aprobado', fechaProceso = ? WHERE id = ?", H.hoy(), args.id);
  await H.addNotification("solicitud", `Solicitud APROBADA: ${row.nombre} ${row.apellido}`, args.id);
  await H.addLog("solicitud_aprobada", `Solicitud aprobada: ${row.nombre} ${row.apellido}`, args.id);
  return { ok: true };
};

const rechazarSolicitud = async (args: { id: string; motivo?: string }) => {
  const db = await getDb();
  const row: any = await db.getFirstAsync("SELECT * FROM solicitudes WHERE id = ?", args.id);
  if (!row) throw new Error("No existe");
  const motivo = (args.motivo || "").trim() || "Sin motivo especificado";
  await db.runAsync(
    "UPDATE solicitudes SET estado = 'rechazado', motivoRechazo = ?, fechaProceso = ? WHERE id = ?",
    motivo,
    H.hoy(),
    args.id
  );
  await H.addNotification("solicitud", `Solicitud RECHAZADA: ${row.nombre} ${row.apellido}`, args.id);
  await H.addLog("solicitud_rechazada", `Solicitud rechazada: ${row.nombre} ${row.apellido} · ${motivo}`, args.id);
  return { ok: true };
};

const listarSolicitudesPrestamo = async () => {
  const db = await getDb();
  const rows: any[] = await db.getAllAsync("SELECT *, id AS _id FROM solicitudesPrestamo");
  const out: any[] = [];
  for (const sp of rows) {
    const cli: any = await db.getFirstAsync("SELECT nombre, apellido, cedula, telefono FROM solicitudes WHERE id = ?", sp.clienteId);
    out.push({
      ...sp,
      nombre: cli ? cli.nombre : null,
      apellido: cli ? cli.apellido : null,
      cedula: cli ? cli.cedula : null,
      telefono: cli ? cli.telefono : null,
      nombre_completo: cli ? `${cli.nombre} ${cli.apellido}`.trim() : "",
    });
  }
  out.sort((a, b) => {
    const pa = a.estado === "pendiente" ? 0 : 1;
    const pb = b.estado === "pendiente" ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return (b.fechaCreacion + b._id).localeCompare(a.fechaCreacion + a._id);
  });
  return out;
};

const aprobarSolicitudPrestamo = async (args: { id: string }) => {
  const db = await getDb();
  const row: any = await db.getFirstAsync("SELECT *, id AS _id FROM solicitudesPrestamo WHERE id = ?", args.id);
  if (!row) throw new Error("No existe");
  if (row.estado !== "pendiente") throw new Error("Esta solicitud ya fue procesada");
  const cli: any = await db.getFirstAsync("SELECT * FROM solicitudes WHERE id = ?", row.clienteId);
  if (!cli) throw new Error("Cliente no encontrado");
  if (cli.bloqueado) throw new Error(`${cli.nombre} ${cli.apellido} está BLOQUEADO en la lista negra.`);

  const venc = H.sumarDias(H.hoy(), 30);
  const moneda = MONEDA_CLI[row.moneda] || "BS";
  const prestamoId = H.nuevoId("pre");
  await db.runAsync(
    `INSERT INTO prestamos (id, clienteId, nombre, cedula, telefono, monto, tasaInteres, fechaPrestamo, tiempo, fechaVencimiento, estado, notas, moneda, fechaCreacion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, '30 dias', ?, 'activo', ?, ?, ?)`,
    prestamoId,
    cli.id,
    `${cli.nombre} ${cli.apellido}`.trim(),
    cli.cedula || null,
    cli.telefono || null,
    row.monto,
    row.tasaInteres || 0,
    H.hoy(),
    venc,
    `Solicitado por el cliente · ${METODOS_SOLICITUD[row.metodoPago] || row.metodoPago} · ${MONEDAS_MAP[row.moneda] || row.moneda}`,
    moneda,
    H.hoy()
  );
  await db.runAsync("UPDATE solicitudesPrestamo SET estado = 'aprobado', fechaProceso = ? WHERE id = ?", H.hoy(), args.id);
  const total = H.deudaTotal(row.monto, row.tasaInteres || 0);
  await H.addNotification(
    "solicitud_prestamo",
    `Préstamo APROBADO y activo para ${cli.nombre} ${cli.apellido} · ${row.moneda.toUpperCase()} ${total}`,
    prestamoId
  );
  await H.addLog(
    "solicitud_prestamo_aprobada",
    `Préstamo aprobado por ${row.moneda.toUpperCase()} ${total} a ${cli.nombre} ${cli.apellido}`,
    prestamoId
  );
  return { ok: true, prestamoId };
};

const rechazarSolicitudPrestamo = async (args: { id: string; motivo?: string }) => {
  const db = await getDb();
  const row: any = await db.getFirstAsync("SELECT * FROM solicitudesPrestamo WHERE id = ?", args.id);
  if (!row) throw new Error("No existe");
  if (row.estado !== "pendiente") throw new Error("Esta solicitud ya fue procesada");
  const motivo = (args.motivo || "").trim() || "Sin motivo especificado";
  await db.runAsync(
    "UPDATE solicitudesPrestamo SET estado = 'rechazado', motivoRechazo = ?, fechaProceso = ? WHERE id = ?",
    motivo,
    H.hoy(),
    args.id
  );
  const cli: any = await db.getFirstAsync("SELECT nombre, apellido FROM solicitudes WHERE id = ?", row.clienteId);
  await H.addNotification(
    "solicitud_prestamo",
    `Solicitud de préstamo RECHAZADA de ${cli ? cli.nombre + " " + cli.apellido : "un cliente"} (${row.moneda.toUpperCase()} ${row.monto})`,
    args.id
  );
  return { ok: true };
};

// ───────────────────────────── pagosCliente ─────────────────────────────
const pagosClienteList = async (args?: { estado?: string }) => {
  const db = await getDb();
  let rows: any[] = await db.getAllAsync(
    `SELECT pg.*, pg.id AS _id,
            pr.nombre AS nombre_prestamo, pr.moneda, pr.monto AS monto_prestamo,
            s.nombre AS nombre_c, s.apellido AS apellido_c, s.cedula, s.telefono
     FROM pagosCliente pg
     LEFT JOIN prestamos pr ON pr.id = pg.prestamoId
     LEFT JOIN solicitudes s ON s.id = pg.clienteId
     ORDER BY CASE pg.estado WHEN 'pendiente' THEN 0 ELSE 1 END, pg.fechaCreacion DESC`
  );
  if (args?.estado) rows = rows.filter((r) => r.estado === args!.estado);
  return rows.map((pc) => ({
    ...pc,
    nombre: pc.nombre_prestamo || "",
    nombre_c: pc.nombre_c || "",
    apellido_c: pc.apellido_c || "",
    metodo_label: METODOS_PAGO_CLIENTE[pc.metodo] || pc.metodo,
  }));
};

const aprobarPagoCliente = async (args: { id: string }) => {
  const db = await getDb();
  const pc: any = await db.getFirstAsync("SELECT * FROM pagosCliente WHERE id = ?", args.id);
  if (!pc) throw new Error("No existe");
  if (pc.estado !== "pendiente") throw new Error("Este pago ya fue procesado");

  let pagoId = pc.pagoId;
  if (!pagoId) {
    const notas = `Abono del cliente · ${METODOS_PAGO_CLIENTE[pc.metodo] || pc.metodo}${pc.referencia ? " · Ref: " + pc.referencia : ""}`;
    pagoId = H.nuevoId("pag");
    await db.runAsync(
      "INSERT INTO pagos (id, prestamoId, monto, fecha, notas) VALUES (?, ?, ?, ?, ?)",
      pagoId,
      pc.prestamoId,
      pc.monto,
      pc.fechaPago,
      notas
    );
    await db.runAsync("UPDATE pagosCliente SET pagoId = ? WHERE id = ?", pagoId, args.id);
  }
  const pr: any = await db.getFirstAsync(`${SELECT_PRE} WHERE id = ?`, pc.prestamoId);
  const det = await H.prestamoDetail(pr);
  const nuevoEstado =
    det && det.saldo <= 0 ? "pagado" : det && det.estadoCalc === "atrasado" ? "atrasado" : "activo";
  await db.runAsync("UPDATE prestamos SET estado = ? WHERE id = ?", nuevoEstado, pc.prestamoId);
  await db.runAsync(
    "UPDATE pagosCliente SET estado = 'aprobado', fechaProceso = ? WHERE id = ?",
    H.hoy(),
    args.id
  );
  await H.addNotification(
    "pago_cliente",
    `Abono aprobado de ${det ? det.moneda + " " : ""}${pc.monto} para ${pr ? pr.nombre : ""}`,
    args.id
  );
  await H.addLog(
    "pago_cliente_aprobado",
    `Abono aprobado de ${pc.monto} (${METODOS_PAGO_CLIENTE[pc.metodo] || pc.metodo}) para ${pr ? pr.nombre : ""}`,
    args.id
  );
  return { ok: true, saldo: det ? det.saldo : null, moneda: det ? det.moneda : "BS" };
};

const rechazarPagoCliente = async (args: { id: string; motivo?: string }) => {
  const db = await getDb();
  const pc: any = await db.getFirstAsync("SELECT * FROM pagosCliente WHERE id = ?", args.id);
  if (!pc) throw new Error("No existe");
  if (pc.estado !== "pendiente") throw new Error("Este pago ya fue procesado");
  const motivo = (args.motivo || "").trim() || "Sin motivo especificado";
  await db.runAsync(
    "UPDATE pagosCliente SET estado = 'rechazado', motivoRechazo = ?, fechaProceso = ? WHERE id = ?",
    motivo,
    H.hoy(),
    args.id
  );
  await H.addNotification("pago_cliente", `Abono rechazado de ${pc.monto} (${motivo})`, args.id);
  await H.addLog("pago_cliente_rechazado", `Abono rechazado de ${pc.monto} · ${motivo}`, args.id);
  return { ok: true };
};

// ───────────────────────────── notificaciones ─────────────────────────────
const notificacionesList = async () => {
  const db = await getDb();
  const rows: any[] = await db.getAllAsync("SELECT *, id AS _id FROM notificaciones");
  rows.sort((a, b) => (b.fecha + b._id).localeCompare(a.fecha + a._id));
  return rows.slice(0, 40);
};

const notificacionesNoLeidas = async () => {
  const db = await getDb();
  const r: any = await db.getFirstAsync("SELECT COUNT(*) AS n FROM notificaciones WHERE leida = 0");
  return r?.n || 0;
};

const marcarNotificacionLeida = async (args: { id: string }) => {
  const db = await getDb();
  await db.runAsync("UPDATE notificaciones SET leida = 1 WHERE id = ?", args.id);
  return { ok: true };
};

const leerTodasNotificaciones = async () => {
  const db = await getDb();
  await db.runAsync("UPDATE notificaciones SET leida = 1 WHERE leida = 0");
  return { ok: true };
};

const eliminarNotificacion = async (args: { id: string }) => {
  const db = await getDb();
  await db.runAsync("DELETE FROM notificaciones WHERE id = ?", args.id);
  return { ok: true };
};

const vaciarNotificaciones = async () => {
  const db = await getDb();
  await db.runAsync("DELETE FROM notificaciones");
  return { ok: true };
};

// ───────────────────────────── recordatorios ─────────────────────────────
const vencimientos = async (args?: { dias?: number }) => {
  const horizonte = Number(args?.dias || 30);
  const db = await getDb();
  const rows: any[] = await db.getAllAsync(`${SELECT_PRE}`);
  const dets: any[] = [];
  for (const p of rows) {
    if (p.estado === "pagado") continue;
    const d = await H.prestamoDetail(p);
    if (d) dets.push(d);
  }
  const hoyStr = H.hoy();
  const proximos = dets
    .filter(
      (p) =>
        p.fechaVencimiento &&
        p.saldo > 0 &&
        H.diasEntre(hoyStr, p.fechaVencimiento) <= horizonte &&
        H.diasEntre(hoyStr, p.fechaVencimiento) >= -1
    )
    .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento));

  const recs: any[] = await db.getAllAsync("SELECT *, id AS _id FROM recordatorios");
  recs.sort((a, b) => (b.fecha + b._id).localeCompare(a.fecha + a._id));
  const ultimosDet: any[] = [];
  for (const r of recs.slice(0, 6)) {
    const pr: any = await db.getFirstAsync("SELECT nombre, moneda, monto FROM prestamos WHERE id = ?", r.prestamoId);
    ultimosDet.push({ ...r, nombre: pr ? pr.nombre : "", moneda: pr ? pr.moneda : "BS", monto: pr ? pr.monto : 0 });
  }
  return { proximos, ultimos: ultimosDet };
};

const enviarRecordatorio = async (args: { prestamoId: string; canal?: string; notas?: string }) => {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO recordatorios (id, prestamoId, canal, notas, fecha) VALUES (?, ?, ?, ?, ?)",
    H.nuevoId("rec"),
    args.prestamoId,
    args.canal || "whatsapp",
    args.notas || null,
    H.hoy()
  );
  await H.addNotification("recordatorio", "Recordatorio de pago enviado", args.prestamoId);
  return { ok: true };
};

// ───────────────────────────── settings ─────────────────────────────
const getConfig = async () => {
  const admin = await usuarioAdmin();
  return {
    negocio_nombre: String(await H.configGet("negocio_nombre", "Mi Negocio de Prestamos")),
    whatsapp_numero: String(await H.configGet("whatsapp_numero", "")),
    pais_wa: String(await H.configGet("pais_wa", "58")),
    mensaje_recordatorio: String(
      await H.configGet(
        "mensaje_recordatorio",
        "Hola {nombre}, te recordamos que tu pago de {monto} vence el {vencimiento}. Gracias."
      )
    ),
    moneda: String(await H.configGet("moneda", "Bs.")),
    tasa_interes: await H.configNum("tasa_interes", 10),
    tasa_mora: await H.configNum("tasa_mora", 0),
    recargo_atraso: await H.configNum("recargo_atraso", 4),
    dias_gracia: await H.configNum("dias_gracia", 3),
    admin_user: admin?.username || "admin",
  };
};

const updateConfig = async (args: {
  negocio_nombre?: string;
  whatsapp_numero?: string;
  pais_wa?: string;
  mensaje_recordatorio?: string;
  moneda?: string;
  tasa_interes?: number;
  tasa_mora?: number;
  recargo_atraso?: number;
  dias_gracia?: number;
}) => {
  const up: [string, string][] = [];
  if (args.negocio_nombre !== undefined) up.push(["negocio_nombre", String(args.negocio_nombre).trim()]);
  if (args.whatsapp_numero !== undefined) up.push(["whatsapp_numero", String(args.whatsapp_numero).trim()]);
  if (args.pais_wa !== undefined) up.push(["pais_wa", String(args.pais_wa).replace(/[^\d]/g, "")]);
  if (args.mensaje_recordatorio !== undefined) up.push(["mensaje_recordatorio", String(args.mensaje_recordatorio)]);
  if (args.moneda !== undefined) up.push(["moneda", String(args.moneda)]);
  if (args.tasa_interes !== undefined) up.push(["tasa_interes", String(Math.max(0, args.tasa_interes))]);
  if (args.tasa_mora !== undefined) up.push(["tasa_mora", String(Math.max(0, args.tasa_mora))]);
  if (args.recargo_atraso !== undefined) up.push(["recargo_atraso", String(Math.max(0, args.recargo_atraso))]);
  if (args.dias_gracia !== undefined) up.push(["dias_gracia", String(Math.max(0, Math.round(args.dias_gracia)))]);
  for (const [k, v] of up) await H.configSet(k, v);
  H.limpiarCacheConfig();
  if (up.length) {
    await H.addLog("config", `Ajustes actualizados: ${up.map(([k]) => k).join(", ")}`);
  }
  await H.addNotification("config", "Configuración actualizada");
  return { ok: true };
};

const getConfigCliente = async (args?: { clienteId?: string }) => {
  const negocio_nombre = String(await H.configGet("negocio_nombre", "Mi Negocio de Prestamos"));
  const whatsapp_numero = String(await H.configGet("whatsapp_numero", ""));
  const moneda = String(await H.configGet("moneda", "Bs."));
  const tasa_dia = (await tasaVigente()).tasa;
  if (!args?.clienteId) return { negocio_nombre, whatsapp_numero, moneda, tasa_dia, tasa_promedio: 0 };
  const db = await getDb();
  const prestamos: any[] = await db.getAllAsync("SELECT tasaInteres, estado FROM prestamos WHERE clienteId = ?", args.clienteId);
  const activos = prestamos.filter((p) => p.estado !== "pagado");
  const tasaPromedio = activos.length
    ? Math.round((activos.reduce((a, p) => a + p.tasaInteres, 0) / activos.length) * 100) / 100
    : 0;
  return { negocio_nombre, whatsapp_numero, moneda, tasa_dia, tasa_promedio: tasaPromedio };
};

// ───────────────────────────── portalCliente ─────────────────────────────
const portalMe = async (args: { clienteId: string }) => {
  const db = await getDb();
  const c: any = await db.getFirstAsync(`${SELECT_SOL} WHERE id = ?`, args.clienteId);
  if (!c) throw new Error("Cliente no encontrado");
  return {
    id: c._id,
    nombre: c.nombre,
    apellido: c.apellido,
    cedula: c.cedula,
    telefono: c.telefono,
    correo: c.correo,
    edad: c.edad,
    ubicacion: c.ubicacion,
    lat: c.lat,
    lng: c.lng,
    codigoRef: c.codigoRef,
    bloqueado: c.bloqueado ? true : false,
    fotoPerfil: c.fotoPerfil,
    fotoFront: c.fotoFront,
    fotoBack: c.fotoBack,
  };
};

// Perfil del cliente asociado a una cuenta de usuario (wizard de 5 pasos).
const perfilCliente = async (args: { userId: string }) => {
  const db = await getDb();
  const u: any = await db.getFirstAsync(
    "SELECT id, username, email, rol, perfilCompleto, solicitudId FROM usuarios WHERE id = ?",
    args.userId
  );
  if (!u) throw new Error("Cuenta no encontrada");
  if (u.rol !== "cliente") return { perfilCompleto: true, username: u.username, email: u.email, perfil: null };
  const sol: any = u.solicitudId
    ? await db.getFirstAsync(`${SELECT_SOL} WHERE id = ?`, u.solicitudId)
    : null;
  return {
    perfilCompleto: !!u.perfilCompleto,
    username: u.username,
    email: u.email,
    perfil: sol
      ? {
          id: sol._id,
          nombre: sol.nombre,
          apellido: sol.apellido,
          cedula: sol.cedula,
          telefono: sol.telefono,
          correo: sol.correo,
          ubicacion: sol.ubicacion,
          lat: sol.lat,
          lng: sol.lng,
          fotoFront: sol.fotoFront,
          fotoBack: sol.fotoBack,
          fotoPerfil: sol.fotoPerfil,
        }
      : null,
  };
};

// Guarda los datos del wizard. Mientras `completar` es false la ficha queda
// en estado 'pendiente' (perfil incompleto); al completar pasa a 'aprobado'.
const guardarPerfil = async (args: {
  userId: string;
  nombre?: string;
  apellido?: string;
  cedula?: string;
  telefono?: string;
  ubicacion?: string;
  lat?: number | null;
  lng?: number | null;
  fotoFront?: string;
  fotoBack?: string;
  fotoPerfil?: string;
  completar?: boolean;
}) => {
  const db = await getDb();
  const u: any = await db.getFirstAsync("SELECT * FROM usuarios WHERE id = ?", args.userId);
  if (!u) throw new Error("Cuenta no encontrada");
  if (u.rol !== "cliente") throw new Error("Esta cuenta no es de cliente");

  const nombre = (args.nombre || "").trim();
  const apellido = (args.apellido || "").trim();
  const cedula = (args.cedula || "").trim().replace(/\s/g, "");
  const completar = !!args.completar;

  if (completar) {
    if (!nombre) throw new Error("Escribe tu nombre (paso 1)");
    if (!apellido) throw new Error("Escribe tu apellido (paso 1)");
    if (!cedula) throw new Error("Ingresa tu número de cédula (paso 2)");
    if (!norm(args.telefono)) throw new Error("Ingresa tu teléfono (paso 3)");
    if (!norm(args.ubicacion)) throw new Error("Escribe tu dirección (paso 4)");
    if (args.lat == null || args.lng == null) {
      throw new Error("Marca tu ubicación en el mapa (paso 4)");
    }
    if (!args.fotoFront || !args.fotoBack) {
      throw new Error("Sube la foto de tu cédula (ambos lados) (paso 5)");
    }
    if (!args.fotoPerfil) throw new Error("Sube tu foto de perfil (paso 5)");
  }

  if (cedula) {
    const dup: any = await db.getFirstAsync(
      u.solicitudId
        ? "SELECT id FROM solicitudes WHERE cedula = ? AND id != ?"
        : "SELECT id FROM solicitudes WHERE cedula = ?",
      ...(u.solicitudId ? [cedula, u.solicitudId] : [cedula])
    );
    if (dup) throw new Error("Esa cédula ya está registrada en el sistema");
  }

  const estado = completar ? "aprobado" : "pendiente";
  const hoyStr = H.hoy();
  let solId: string = u.solicitudId || "";

  if (u.solicitudId) {
    await db.runAsync(
      `UPDATE solicitudes SET nombre = COALESCE(NULLIF(?, ''), nombre),
         apellido = COALESCE(NULLIF(?, ''), apellido),
         cedula = COALESCE(NULLIF(?, ''), cedula),
         telefono = COALESCE(NULLIF(?, ''), telefono),
         ubicacion = COALESCE(NULLIF(?, ''), ubicacion),
         lat = CASE WHEN ? IS NULL THEN lat ELSE ? END,
         lng = CASE WHEN ? IS NULL THEN lng ELSE ? END,
         fotoFront = COALESCE(NULLIF(?, ''), fotoFront),
         fotoBack = COALESCE(NULLIF(?, ''), fotoBack),
         fotoPerfil = COALESCE(NULLIF(?, ''), fotoPerfil),
         correo = COALESCE(NULLIF(?, ''), correo),
         estado = CASE WHEN ? = 'aprobado' THEN 'aprobado' ELSE estado END,
         fechaProceso = CASE WHEN ? = 'aprobado' THEN ? ELSE fechaProceso END
       WHERE id = ?`,
      nombre,
      apellido,
      cedula,
      norm(args.telefono),
      (args.ubicacion || "").trim(),
      args.lat ?? null,
      args.lat ?? null,
      args.lng ?? null,
      args.lng ?? null,
      args.fotoFront || "",
      args.fotoBack || "",
      args.fotoPerfil || "",
      u.email || "",
      estado,
      estado,
      hoyStr,
      solId
    );
  } else {
    solId = H.nuevoId("sol");
    await db.runAsync(
      `INSERT INTO solicitudes (id, codigoRef, nombre, apellido, cedula, telefono, ubicacion, lat, lng,
         fotoFront, fotoBack, fotoPerfil, correo, estado, bloqueado, fechaCreacion, fechaProceso)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      solId,
      nombre || "Cliente",
      apellido || "Nuevo",
      cedula || `PEND-${solId.slice(-6)}`,
      args.telefono ? norm(args.telefono) : null,
      (args.ubicacion || "").trim() || null,
      args.lat ?? null,
      args.lng ?? null,
      args.fotoFront || null,
      args.fotoBack || null,
      args.fotoPerfil || null,
      u.email || null,
      estado,
      hoyStr,
      completar ? hoyStr : null
    );
    await db.runAsync("UPDATE solicitudes SET codigoRef = ? WHERE id = ?", H.generarCodigo(nombre, solId), solId);
    await db.runAsync("UPDATE usuarios SET solicitudId = ? WHERE id = ?", solId, u.id);
  }

  if (completar) {
    await db.runAsync("UPDATE usuarios SET perfilCompleto = 1, solicitudId = ? WHERE id = ?", solId, u.id);
    await H.addNotification(
      "cliente",
      `Cliente ${nombre} ${apellido} completó su perfil (cédula ${cedula})`,
      solId
    );
  }

  return { ok: true, solicitudId: solId, perfilCompleto: completar, nombre, apellido };
};

const misPrestamos = async (args: { clienteId: string }) => {
  const db = await getDb();
  const rows: any[] = await db.getAllAsync(
    `${SELECT_PRE} WHERE clienteId = ? ORDER BY fechaPrestamo DESC`,
    args.clienteId
  );
  const out: any[] = [];
  for (const p of rows) {
    const d = await H.prestamoDetail(p);
    if (d) out.push(d);
  }
  return out;
};

const misPagos = async (args: { clienteId: string }) => {
  const db = await getDb();
  const prestamos: any[] = await db.getAllAsync(`${SELECT_PRE} WHERE clienteId = ?`, args.clienteId);
  const out: any[] = [];
  for (const pr of prestamos) {
    const pagos: any[] = await db.getAllAsync("SELECT *, id AS _id FROM pagos WHERE prestamoId = ?", pr._id);
    for (const pg of pagos) {
      out.push({ ...pg, nombre: pr.nombre, monto_prestamo: pr.monto, moneda: pr.moneda || "BS" });
    }
  }
  out.sort((a, b) => (b.fecha + b._id).localeCompare(a.fecha + a._id));
  return out;
};

const misPagosEnviados = async (args: { clienteId: string }) => {
  const db = await getDb();
  const rows: any[] = await db.getAllAsync(
    "SELECT *, id AS _id FROM pagosCliente WHERE clienteId = ?",
    args.clienteId
  );
  const out: any[] = [];
  for (const pc of rows) {
    const pr: any = await db.getFirstAsync("SELECT nombre, moneda FROM prestamos WHERE id = ?", pc.prestamoId);
    out.push({
      ...pc,
      nombre: pr ? pr.nombre : "",
      moneda: (pr && pr.moneda) || "BS",
      metodo_label: METODOS_PAGO_CLIENTE[pc.metodo] || pc.metodo,
    });
  }
  out.sort((a, b) => (b.fechaCreacion + b._id).localeCompare(a.fechaCreacion + a._id));
  return out;
};

const misSolicitudesPrestamo = async (args: { clienteId: string }) => {
  const db = await getDb();
  const rows: any[] = await db.getAllAsync(
    "SELECT *, id AS _id FROM solicitudesPrestamo WHERE clienteId = ?",
    args.clienteId
  );
  return rows
    .sort((a, b) => (b.fechaCreacion + b._id).localeCompare(a.fechaCreacion + a._id))
    .map((r) => ({
      ...r,
      metodo_label: METODOS_SOLICITUD[r.metodoPago] || r.metodoPago,
      moneda_label: MONEDAS_MAP[r.moneda] || r.moneda,
    }));
};

const pagarCliente = async (args: {
  clienteId: string;
  prestamoId: string;
  monto: number;
  metodo: string;
  referencia?: string;
  comprobante?: string;
  fechaPago?: string;
  telefono: string;
  cedula: string;
}) => {
  if (!args.monto || args.monto <= 0) throw new Error("Ingresa un monto válido");
  const db = await getDb();
  const prestamo: any = await db.getFirstAsync(`${SELECT_PRE} WHERE id = ?`, args.prestamoId);
  if (!prestamo || prestamo.clienteId !== args.clienteId) throw new Error("Préstamo no encontrado");
  const det = await H.prestamoDetail(prestamo);
  if (!det || det.saldo <= 0) throw new Error("Este préstamo ya está pagado");
  if (!METODOS_PAGO_CLIENTE[args.metodo]) throw new Error("Selecciona un método de pago");
  if (args.metodo === "transferencia" && !(args.referencia || "").trim()) {
    throw new Error("Para transferencia debes escribir el número de referencia");
  }
  const cliente: any = await db.getFirstAsync(`${SELECT_SOL} WHERE id = ?`, args.clienteId);
  if (!cliente) throw new Error("Cliente no encontrado");
  if (!args.telefono || !args.cedula) throw new Error("Ingresa tu teléfono y cédula");
  if ((cliente.cedula || "").replace(/\s/g, "") !== args.cedula.trim().replace(/\s/g, "")) {
    throw new Error("La cédula no coincide con tu cuenta");
  }
  if (norm(cliente.telefono) !== norm(args.telefono)) throw new Error("El teléfono no coincide con tu cuenta");

  const id = H.nuevoId("pc");
  await db.runAsync(
    `INSERT INTO pagosCliente (id, clienteId, prestamoId, monto, metodo, referencia, comprobante, estado, fechaPago, fechaCreacion)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?)`,
    id,
    args.clienteId,
    args.prestamoId,
    args.monto,
    args.metodo,
    (args.referencia || "").trim() || null,
    args.comprobante || null,
    args.fechaPago || H.hoy(),
    H.hoy()
  );
  const montoTxt = `${det.moneda} ${H.redondear(args.monto)}`;
  await H.addNotification(
    "pago_cliente",
    `${cliente.nombre} ${cliente.apellido} envió un pago de ${montoTxt} (${METODOS_PAGO_CLIENTE[args.metodo]}${args.referencia ? " · Ref: " + args.referencia : ""})`,
    id
  );
  return { ok: true, id };
};

const solicitarPrestamo = async (args: {
  clienteId: string;
  monto: number;
  metodoPago: string;
  moneda: string;
  esCuotas?: boolean;
  numeroCuotas?: number;
}) => {
  const monto = args.monto;
  if (!monto || monto <= 0) throw new Error("Ingresa un monto válido");
  if (!METODOS_SOLICITUD[args.metodoPago]) throw new Error("Selecciona un método de pago");
  if (!MONEDAS_MAP[args.moneda]) throw new Error("Selecciona una moneda");
  const db = await getDb();
  const cliente: any = await db.getFirstAsync(`${SELECT_SOL} WHERE id = ?`, args.clienteId);
  if (!cliente) throw new Error("Cliente no encontrado");
  if (cliente.bloqueado) throw new Error("Estás bloqueado. Comunícate con el administrador.");

  // Bloquear si ya tiene préstamo activo
  const prestamoActivo: any = await db.getFirstAsync(
    `SELECT id FROM prestamos WHERE clienteId = ? AND estado IN ('activo', 'atrasado') LIMIT 1`,
    args.clienteId
  );
  if (prestamoActivo) {
    throw new Error("Ya tienes un préstamo activo. Debes saldarlo antes de solicitar uno nuevo.");
  }

  // Validar cuotas según estrellas del cliente
  const esCuotas = !!args.esCuotas;
  const estrellas = Number(cliente.estrellas) || 0;
  const maxCuotas = estrellas >= 5 ? estrellas : 0;
  let numeroCuotas = esCuotas ? Math.max(1, Number(args.numeroCuotas) || maxCuotas) : 1;
  if (esCuotas && maxCuotas === 0) {
    throw new Error("Necesitas al menos 5 estrellas para solicitar préstamos por cuotas.");
  }
  if (esCuotas && numeroCuotas > maxCuotas) {
    numeroCuotas = maxCuotas;
  }

  const tasa = (await tasaVigente()).tasa;
  const id = H.nuevoId("sp");
  await db.runAsync(
    `INSERT INTO solicitudesPrestamo (id, clienteId, monto, metodoPago, moneda, tasaInteres, estado, fechaCreacion, esCuotas, numeroCuotas)
     VALUES (?, ?, ?, ?, ?, ?, 'pendiente', ?, ?, ?)`,
    id,
    args.clienteId,
    monto,
    args.metodoPago,
    args.moneda,
    tasa,
    H.hoy(),
    esCuotas ? 1 : 0,
    numeroCuotas
  );
  const cuotasTxt = esCuotas ? ` · ${numeroCuotas} cuotas` : "";
  await H.addNotification(
    "solicitud_prestamo",
    `${cliente.nombre} ${cliente.apellido} quiere un préstamo de ${args.moneda.toUpperCase()} ${monto} · ${METODOS_SOLICITUD[args.metodoPago]}${cuotasTxt}`,
    id
  );
  return { ok: true, id };
};

// Admin personaliza y aprueba la solicitud de préstamo
const personalizarYAprobarSolicitudPrestamo = async (args: {
  id: string;
  tasaInteres?: number;
  fechaVencimiento?: string;
  esCuotas?: boolean;
  numeroCuotas?: number;
}) => {
  const db = await getDb();
  const row: any = await db.getFirstAsync("SELECT *, id AS _id FROM solicitudesPrestamo WHERE id = ?", args.id);
  if (!row) throw new Error("No existe");
  if (row.estado !== "pendiente") throw new Error("Esta solicitud ya fue procesada");
  const cli: any = await db.getFirstAsync("SELECT * FROM solicitudes WHERE id = ?", row.clienteId);
  if (!cli) throw new Error("Cliente no encontrado");
  if (cli.bloqueado) throw new Error(`${cli.nombre} ${cli.apellido} está BLOQUEADO en la lista negra.`);

  // Bloquear si ya tiene préstamo activo
  const prestamoActivo: any = await db.getFirstAsync(
    `SELECT id FROM prestamos WHERE clienteId = ? AND estado IN ('activo', 'atrasado') LIMIT 1`,
    row.clienteId
  );
  if (prestamoActivo) {
    throw new Error(`${cli.nombre} ${cli.apellido} ya tiene un préstamo activo y no puede recibir otro.`);
  }

  const tasa = args.tasaInteres !== undefined ? Number(args.tasaInteres) : Number(row.tasaInteres);
  if (!Number.isFinite(tasa) || tasa < 0 || tasa > 1000) throw new Error("Tasa de interés inválida");

  const venc = args.fechaVencimiento || H.sumarDias(H.hoy(), 30);
  const moneda = MONEDA_CLI[row.moneda] || "BS";

  const esCuotas = args.esCuotas !== undefined ? !!args.esCuotas : !!row.esCuotas;
  const numeroCuotas = args.numeroCuotas !== undefined ? Math.max(1, Number(args.numeroCuotas)) : Math.max(1, Number(row.numeroCuotas) || 1);

  const prestamoId = H.nuevoId("pre");
  const cuotasNotas = esCuotas ? ` · ${numeroCuotas} cuotas` : "";
  await db.runAsync(
    `INSERT INTO prestamos (id, clienteId, nombre, cedula, telefono, monto, tasaInteres, fechaPrestamo, tiempo, fechaVencimiento, estado, notas, moneda, fechaCreacion, esCuotas, numeroCuotas)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, '30 dias', ?, 'activo', ?, ?, ?, ?, ?)`,
    prestamoId,
    cli.id,
    `${cli.nombre} ${cli.apellido}`.trim(),
    cli.cedula || null,
    cli.telefono || null,
    row.monto,
    tasa,
    H.hoy(),
    venc,
    `Solicitado por el cliente · ${METODOS_SOLICITUD[row.metodoPago] || row.metodoPago} · ${MONEDAS_MAP[row.moneda] || row.moneda}${cuotasNotas}`,
    moneda,
    H.hoy(),
    esCuotas ? 1 : 0,
    numeroCuotas
  );
  await db.runAsync("UPDATE solicitudesPrestamo SET estado = 'aprobado', fechaProceso = ? WHERE id = ?", H.hoy(), args.id);
  const total = H.deudaTotal(row.monto, tasa);
  await H.addNotification(
    "solicitud_prestamo",
    `Préstamo APROBADO para ${cli.nombre} ${cli.apellido} · ${row.moneda.toUpperCase()} ${total} · tasa ${tasa}%${cuotasNotas} · vence ${venc}`,
    prestamoId
  );
  await H.addLog(
    "solicitud_prestamo_aprobada",
    `Préstamo por ${row.moneda.toUpperCase()} ${total} a ${cli.nombre} ${cli.apellido} · tasa ${tasa}% · vence ${venc}${cuotasNotas}`,
    prestamoId
  );
  return { ok: true, prestamoId };
};

// Obtiene las estrellas de un cliente
const getEstrellas = async (args: { clienteId: string }) => {
  const db = await getDb();
  const cli: any = await db.getFirstAsync("SELECT estrellas FROM solicitudes WHERE id = ?", args.clienteId);
  return { estrellas: cli ? (Number(cli.estrellas) || 0) : 0 };
};

// Admin actualiza las estrellas de un cliente
const actualizarEstrellas = async (args: { clienteId: string; estrellas: number }) => {
  const estrellas = Math.max(0, Math.round(Number(args.estrellas)));
  const db = await getDb();
  const cli: any = await db.getFirstAsync("SELECT nombre, apellido FROM solicitudes WHERE id = ?", args.clienteId);
  if (!cli) throw new Error("Cliente no encontrado");
  await db.runAsync("UPDATE solicitudes SET estrellas = ? WHERE id = ?", estrellas, args.clienteId);
  await H.addLog("estrellas_actualizadas", `Estrellas de ${cli.nombre} ${cli.apellido}: ${estrellas}⭐`, args.clienteId);
  return { ok: true, estrellas };
};

// ────────────────── historial y reportes del cliente ──────────────────
// La tabla `pagos` es el libro real de abonos: incluye los que registra el
// administrador y los que aprueba el cliente (en ese caso queda el pagoId).
const historialPagos = async (args: { clienteId: string; desde?: string; hasta?: string }) => {
  const db = await getDb();
  const prestamos: any[] = await db.getAllAsync(
    `${SELECT_PRE} WHERE clienteId = ?`,
    args.clienteId
  );
  const desde = (args.desde || "").slice(0, 10);
  const hasta = (args.hasta || "").slice(0, 10);
  const out: any[] = [];

  for (const pr of prestamos) {
    const pagos: any[] = await db.getAllAsync(
      "SELECT *, id AS _id FROM pagos WHERE prestamoId = ? ORDER BY fecha ASC, _id ASC",
      pr._id
    );
    // saldo progresivo del préstamo para contextualizar cada abono
    let acumulado = 0;
    const total = Number(pr.monto) || 0;
    for (const pg of pagos) {
      acumulado += Number(pg.monto) || 0;
      const origen: any = pg.pagoId
        ? await db.getFirstAsync(
            "SELECT metodo, referencia, estado, fechaPago FROM pagosCliente WHERE pagoId = ?",
            pg.pagoId
          )
        : null;
      const fecha = String(pg.fecha || "").slice(0, 10);
      if (desde && fecha < desde) continue;
      if (hasta && fecha > hasta) continue;
      out.push({
        id: pg._id,
        fecha: pg.fecha,
        monto: Number(pg.monto) || 0,
        notas: pg.notas || "",
        concepto: pg.notas || "Abono registrado",
        prestamoId: pr._id,
        moneda: pr.moneda || "BS",
        prestamoMonto: total,
        referencia: (origen && origen.referencia) || "",
        metodo: (origen && METODOS_PAGO_CLIENTE[origen.metodo]) || "Abono",
        estado: (origen && origen.estado) || "registrado",
        saldo: Math.max(0, H.redondear(total - acumulado)),
      });
    }
  }

  out.sort((a, b) => String(b.fecha + b.id).localeCompare(String(a.fecha + a.id)));
  return out;
};

// Resumen numérico para el dashboard y la pantalla de reportes.
const resumenCliente = async (args: { clienteId: string }) => {
  const db = await getDb();
  const prestamos: any[] = await db.getAllAsync(`${SELECT_PRE} WHERE clienteId = ?`, args.clienteId);
  const acc: {
    borrowed: number;
    paid: number;
    balance: number;
    active: number;
    paidOff: number;
    overdue: number;
    currency: string;
    porMoneda: Record<string, { borrowed: number; paid: number; balance: number; prestamos: number }>;
  } = {
    borrowed: 0,
    paid: 0,
    balance: 0,
    active: 0,
    paidOff: 0,
    overdue: 0,
    currency: "BS",
    porMoneda: {},
  };

  for (const pr of prestamos) {
    const det = await H.prestamoDetail(pr);
    if (!det) continue;
    const monto = Number(det.monto) || 0;
    const pagado = monto - (Number(det.saldo) || 0);
    const saldo = Number(det.saldo) || 0;
    acc.borrowed += monto;
    acc.paid += pagado;
    acc.balance += saldo;
    if (!acc.currency || acc.currency === "BS") acc.currency = pr.moneda || "BS";
    const clave = H.monedaValida(pr.moneda);
    const grupo = (acc.porMoneda[clave] = acc.porMoneda[clave] || {
      borrowed: 0,
      paid: 0,
      balance: 0,
      prestamos: 0,
    });
    grupo.borrowed = H.redondear(grupo.borrowed + monto);
    grupo.paid = H.redondear(grupo.paid + pagado);
    grupo.balance = H.redondear(grupo.balance + saldo);
    grupo.prestamos++;
    if (det.saldo <= 0) acc.paidOff++;
    else if (det.estadoCalc === "atrasado") acc.overdue++;
    else acc.active++;
  }

  const solicitudes: any[] = await db.getAllAsync(
    "SELECT estado FROM solicitudesPrestamo WHERE clienteId = ?",
    args.clienteId
  );
  const pendientes = solicitudes.filter((s) => s.estado === "pendiente").length;

  const pc: any[] = await db.getAllAsync(
    "SELECT estado FROM pagosCliente WHERE clienteId = ?",
    args.clienteId
  );

  return {
    borrowed: H.redondear(acc.borrowed),
    paid: H.redondear(acc.paid),
    balance: H.redondear(acc.balance),
    active: acc.active,
    paidOff: acc.paidOff,
    overdue: acc.overdue,
    currency: acc.currency,
    porMoneda: acc.porMoneda,
    pendingRequests: pendientes,
    pendingPayments: pc.filter((p) => p.estado === "pendiente").length,
    loans: prestamos.length,
  };
};

// Próximos vencimientos para el calendario del cliente.
const calendarioCliente = async (args: { clienteId: string }) => {
  const db = await getDb();
  const prestamos: any[] = await db.getAllAsync(
    `${SELECT_PRE} WHERE clienteId = ?`,
    args.clienteId
  );
  const hoy = H.hoy();
  const out: any[] = [];
  for (const pr of prestamos) {
    const det = await H.prestamoDetail(pr);
    if (!det) continue;
    if (!det.fechaVencimiento) continue;
    out.push({
      prestamoId: pr._id,
      nombre: pr.nombre,
      moneda: det.moneda,
      monto: det.monto,
      saldo: det.saldo,
      tasaInteres: pr.tasaInteres,
      fechaPrestamo: pr.fechaPrestamo,
      fechaVencimiento: det.fechaVencimiento,
      tiempo: pr.tiempo,
      estado: det.saldo <= 0 ? "pagado" : det.estadoCalc,
      dias: Math.round(
        (new Date(det.fechaVencimiento + "T00:00:00").getTime() - new Date(hoy + "T00:00:00").getTime()) /
          86400000
      ),
    });
  }
  return out.sort((a, b) => String(a.fechaVencimiento).localeCompare(String(b.fechaVencimiento)));
};

// ───────────────────────────── registro público ─────────────────────────────
const infoRegistro = async (args?: { ref?: string }) => {
  let ref: { nombre: string; codigo: string } | null = null;
  if (args?.ref) {
    const db = await getDb();
    const row: any = await db.getFirstAsync(
      `${SELECT_SOL} WHERE codigoRef = ? AND estado = 'aprobado'`,
      args.ref
    );
    if (row) ref = { nombre: `${row.nombre} ${row.apellido}`, codigo: args.ref };
  }
  return {
    negocio: String(await H.configGet("negocio_nombre", "Mi Negocio de Prestamos")),
    moneda: String(await H.configGet("moneda", "Bs.")),
    ref,
  };
};

const registrarSolicitud = async (args: {
  nombre: string;
  apellido: string;
  cedula: string;
  edad?: number;
  telefono?: string;
  correo?: string;
  notas?: string;
  lat?: number;
  lng?: number;
  ubicacion?: string;
  fotoFront: string;
  fotoBack: string;
  ref?: string;
}) => {
  const nombre = (args.nombre || "").trim();
  const apellido = (args.apellido || "").trim();
  const cedula = (args.cedula || "").trim().replace(/\s/g, "");
  if (!nombre || !apellido || !cedula) throw new Error("Nombre, apellido y cédula son obligatorios");
  if (!args.fotoFront || !args.fotoBack) {
    throw new Error("Debes subir las fotos de tu cédula (ambos lados)");
  }
  const db = await getDb();
  const exist: any = await db.getFirstAsync("SELECT estado FROM solicitudes WHERE cedula = ?", cedula);
  if (exist) {
    if (exist.estado === "pendiente") throw new Error("Ya tienes una solicitud pendiente por revisar.");
    if (exist.estado === "aprobado") throw new Error("Esta cédula ya está registrada y aprobada.");
    throw new Error("Esta cédula ya fue procesada. Contacta al administrador.");
  }

  let refNombre: string | undefined;
  let refCodigo: string | undefined;
  if (args.ref) {
    const row: any = await db.getFirstAsync(
      `${SELECT_SOL} WHERE codigoRef = ? AND estado = 'aprobado'`,
      args.ref
    );
    if (row) {
      refNombre = `${row.nombre} ${row.apellido}`;
      refCodigo = args.ref;
    }
  }

  const id = H.nuevoId("sol");
  await db.runAsync(
    `INSERT INTO solicitudes (id, codigoRef, nombre, apellido, cedula, edad, fotoFront, fotoBack, lat, lng, ubicacion, referidoPor, referenciaCodigo, telefono, notas, correo, estado, bloqueado, fechaCreacion)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', 0, ?)`,
    id,
    nombre,
    apellido,
    cedula,
    args.edad ?? null,
    args.fotoFront,
    args.fotoBack,
    args.lat ?? null,
    args.lng ?? null,
    args.ubicacion || null,
    refNombre || null,
    refCodigo || null,
    args.telefono || null,
    args.notas || null,
    args.correo || null,
    H.hoy()
  );
  await db.runAsync("UPDATE solicitudes SET codigoRef = ? WHERE id = ?", H.generarCodigo(nombre, id), id);
  await H.addNotification("solicitud", `Nueva solicitud de registro: ${nombre} ${apellido} (cédula ${cedula})`, id);
  return { ok: true, id };
};

// ───────────────────────────── summary ─────────────────────────────
const summary = async () => {
  const db = await getDb();
  const prestamos: any[] = await db.getAllAsync(`${SELECT_PRE}`);
  const dets: any[] = await H.detallesPrestamos(prestamos);

  const sumarPorMoneda = (rows: any[], campo: string): Record<string, number> =>
    rows.reduce((acc: any, p: any) => {
      const m = p.moneda || "BS";
      acc[m] = H.redondear((acc[m] || 0) + Number(p[campo] || 0));
      return acc;
    }, {});

  const capitalPre = prestamos.filter((p) => p.estado !== "pagado");
  const capital_cur = sumarPorMoneda(capitalPre, "monto");
  const total_saldo_cur = sumarPorMoneda(dets.filter((p) => p.estadoCalc !== "pagado"), "totalAdeudado");

  const hoyStr = H.hoy();
  // JOIN en vez de una consulta por pago.
  const pagosHoy: any[] = await db.getAllAsync(
    "SELECT pg.monto, pr.moneda FROM pagos pg LEFT JOIN prestamos pr ON pr.id = pg.prestamoId WHERE pg.fecha = ?",
    hoyStr
  );
  const cobrado_hoy_cur = pagosHoy.reduce((acc: any, pg: any) => {
    const m = pg.moneda || "BS";
    acc[m] = H.redondear((acc[m] || 0) + Number(pg.monto || 0));
    return acc;
  }, {});

  const capital = H.redondear(capitalPre.reduce((a: number, p: any) => a + p.monto, 0));
  const activos = dets.filter((p) => p.estadoCalc === "activo");
  const atrasados = dets.filter((p) => p.estadoCalc === "atrasado");
  const totalSaldo = H.redondear([...activos, ...atrasados].reduce((a: number, p: any) => a + p.totalAdeudado, 0));
  const moraTotal = H.redondear(atrasados.reduce((a: number, p: any) => a + p.mora, 0));
  const moraPorMoneda = sumarPorMoneda(atrasados, "mora");
  const carteraPorMoneda = sumarPorMoneda(
    dets.filter((p) => p.estadoCalc !== "pagado"),
    "totalAdeudado"
  );

  const pendientes: any[] = await db.getAllAsync("SELECT id FROM solicitudes WHERE estado = 'pendiente'");
  const aprobados: any[] = await db.getAllAsync("SELECT id FROM solicitudes WHERE estado = 'aprobado'");
  const rechazados: any[] = await db.getAllAsync("SELECT id FROM solicitudes WHERE estado = 'rechazado'");
  const solicitudesPrestamoPendientes: any[] = await db.getAllAsync(
    "SELECT id FROM solicitudesPrestamo WHERE estado = 'pendiente'"
  );
  const pagosClientePendientes: any[] = await db.getAllAsync(
    "SELECT id FROM pagosCliente WHERE estado = 'pendiente'"
  );

  const vencimientos_proximos = dets.filter(
    (p) =>
      p.fechaVencimiento &&
      p.saldo > 0 &&
      p.estadoCalc !== "pagado" &&
      p.fechaVencimiento >= hoyStr &&
      p.fechaVencimiento <= H.sumarDias(hoyStr, 7)
  ).length;

  const noLeidas: any[] = await db.getAllAsync("SELECT id FROM notificaciones WHERE leida = 0");

  return {
    capital,
    capital_cur,
    total_saldo: totalSaldo,
    total_saldo_cur,
    cartera_por_moneda: carteraPorMoneda,
    cobrado_hoy_cur,
    mora_total: moraTotal,
    mora_por_moneda: moraPorMoneda,
    prestamos_activos: dets.length,
    activos: activos.length,
    atrasados_count: atrasados.length,
    // Alias que consume la pantalla de Inicio.
    prestamos_atrasados: atrasados.length,
    pendientes: pendientes.length,
    solicitudes_pendientes: pendientes.length,
    solicitudes_prestamo_pendientes: solicitudesPrestamoPendientes.length,
    pagos_cliente_pendientes: pagosClientePendientes.length,
    clientes: aprobados.length,
    rechazados: rechazados.length,
    vencimientos_proximos,
    notify_unread: noLeidas.length,
    negocio_nombre: String(await H.configGet("negocio_nombre", "Mi Negocio de Prestamos")),
    tasa_interes: (await tasaVigente()).tasa,
    tasa_mora: await H.configNum("tasa_mora", 0),
    recargo_atraso: await H.configNum("recargo_atraso", 4),
    dias_gracia: await H.configNum("dias_gracia", 3),
  };
};

// ───────────────────────────── intereses del día ─────────────────────────────
const SELECT_INT = "SELECT *, id AS _id FROM intereses";

// Tasa vigente: la del día de hoy si existe, si no la más reciente.
// Orden determinista: si dos tasas se registran el mismo día, gana la última
// escrita (creadoEn lleva hora) y a igualdad de segundo la de mayor id.
const ORDEN_INT = "ORDER BY fecha DESC, creadoEn DESC, rowid DESC";

const tasaVigente = async (): Promise<{ tasa: number; fecha: string; id: string | null }> => {
  const db = await getDb();
  const hoyStr = H.hoy();
  const deHoy: any = await db.getFirstAsync(`${SELECT_INT} WHERE fecha = ? ${ORDEN_INT} LIMIT 1`, hoyStr);
  if (deHoy) return { tasa: Number(deHoy.tasa), fecha: deHoy.fecha, id: deHoy._id };
  const ultima: any = await db.getFirstAsync(`${SELECT_INT} ${ORDEN_INT} LIMIT 1`);
  if (ultima) return { tasa: Number(ultima.tasa), fecha: ultima.fecha, id: ultima._id };
  const respaldo = await H.configNum("tasa_interes", 10);
  return { tasa: respaldo, fecha: hoyStr, id: null };
};

const interesesList = async (args?: { limite?: number }) => {
  const db = await getDb();
  const limite = Math.max(1, Math.min(500, Number(args?.limite || 30)));
  return await db.getAllAsync(`${SELECT_INT} ${ORDEN_INT} LIMIT ?`, limite);
};

const interesActual = async () => {
  const db = await getDb();
  const vigente = await tasaVigente();
  const usos: any = await db.getFirstAsync(
    "SELECT COUNT(*) AS total FROM prestamos WHERE tasaInteres = ? AND estado != 'pagado'",
    vigente.tasa
  );
  return {
    ...vigente,
    prestamosQueLoUsan: Number(usos?.total || 0),
    hoy: H.hoy(),
  };
};

const crearInteres = async (args: { tasa: number; fecha?: string; nota?: string }) => {
  const tasa = Number(args.tasa);
  if (!Number.isFinite(tasa) || tasa < 0 || tasa > 1000) throw new Error("Tasa inválida");
  const db = await getDb();
  const fecha = args.fecha || H.hoy();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error("Fecha inválida");
  const id = H.nuevoId("int");
  await db.runAsync(
    "INSERT INTO intereses (id, fecha, tasa, nota, creadoEn) VALUES (?, ?, ?, ?, ?)",
    id,
    fecha,
    H.redondear(tasa),
    args.nota || null,
    H.ahora()
  );
  await H.addLog("interes_creado", `Tasa ${H.redondear(tasa)}% registrada para el ${fecha}`, id);
  return { ok: true, id };
};

const actualizarInteres = async (args: { id: string; tasa?: number; fecha?: string; nota?: string }) => {
  const db = await getDb();
  const row: any = await db.getFirstAsync(`${SELECT_INT} WHERE id = ?`, args.id);
  if (!row) throw new Error("Tasa no encontrada");
  const tasa = args.tasa === undefined ? Number(row.tasa) : Number(args.tasa);
  if (!Number.isFinite(tasa) || tasa < 0 || tasa > 1000) throw new Error("Tasa inválida");
  const fecha = args.fecha || row.fecha;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error("Fecha inválida");
  await db.runAsync(
    "UPDATE intereses SET fecha = ?, tasa = ?, nota = ? WHERE id = ?",
    fecha,
    H.redondear(tasa),
    args.nota === undefined ? row.nota : args.nota || null,
    args.id
  );
  await H.addLog(
    "interes_editado",
    `Tasa del ${fecha}: ${row.tasa}% → ${H.redondear(tasa)}%`,
    args.id
  );
  return { ok: true, id: args.id };
};

const eliminarInteres = async (args: { id: string }) => {
  const db = await getDb();
  const row: any = await db.getFirstAsync(`${SELECT_INT} WHERE id = ?`, args.id);
  await db.runAsync("DELETE FROM intereses WHERE id = ?", args.id);
  if (row) {
    await H.addLog("interes_eliminado", `Tasa ${row.tasa}% del ${row.fecha} eliminada`, args.id);
  }
  return { ok: true };
};

// ─────────────────────── Reportes y bitácora ───────────────────────
const bitacoraList = async (args?: { limite?: number; accion?: string }) => {
  const db = await getDb();
  const limite = Math.max(1, Math.min(500, Number(args?.limite) || 60));
  if (args?.accion) {
    return await db.getAllAsync(
      "SELECT *, id AS _id FROM bitacora WHERE accion = ? ORDER BY fecha DESC, hora DESC LIMIT ?",
      args.accion,
      limite
    );
  }
  return await db.getAllAsync(
    "SELECT *, id AS _id FROM bitacora ORDER BY fecha DESC, hora DESC LIMIT ?",
    limite
  );
};

// Historial de pagos del negocio con rango de fechas y paginación.
const pagosHistorial = async (args?: {
  desde?: string;
  hasta?: string;
  limite?: number;
  offset?: number;
}) => {
  const db = await getDb();
  const desde = args?.desde || "0000-01-01";
  const hasta = args?.hasta || "9999-12-31";
  const limite = Math.max(1, Math.min(200, Number(args?.limite) || 50));
  const offset = Math.max(0, Number(args?.offset) || 0);
  const totalRow: any = await db.getFirstAsync(
    "SELECT COUNT(*) AS n, COALESCE(SUM(pg.monto), 0) AS total FROM pagos pg WHERE pg.fecha BETWEEN ? AND ?",
    desde,
    hasta
  );
  const items: any[] = await db.getAllAsync(
    `SELECT pg.*, pg.id AS _id, pr.nombre, pr.moneda, pr.cedula, pr.tasaInteres, pr.fechaPrestamo
     FROM pagos pg LEFT JOIN prestamos pr ON pr.id = pg.prestamoId
     WHERE pg.fecha BETWEEN ? AND ?
     ORDER BY pg.fecha DESC, rowid DESC
     LIMIT ? OFFSET ?`,
    desde,
    hasta,
    limite,
    offset
  );
  const porMoneda: any[] = await db.getAllAsync(
    `SELECT COALESCE(pr.moneda, 'BS') AS moneda, COALESCE(SUM(pg.monto), 0) AS total, COUNT(*) AS n
     FROM pagos pg LEFT JOIN prestamos pr ON pr.id = pg.prestamoId
     WHERE pg.fecha BETWEEN ? AND ? GROUP BY moneda`,
    desde,
    hasta
  );
  const condonaciones: any = await db.getFirstAsync(
    "SELECT COUNT(*) AS n, COALESCE(SUM(monto), 0) AS total FROM pagos WHERE notas LIKE 'Condonación%' AND fecha BETWEEN ? AND ?",
    desde,
    hasta
  );
  return {
    items,
    total: Number(totalRow?.n || 0),
    suma: H.redondear(Number(totalRow?.total || 0)),
    hayMas: offset + items.length < Number(totalRow?.n || 0),
    porMoneda: porMoneda.map((r) => ({ moneda: r.moneda, total: H.redondear(r.total || 0), n: r.n })),
    condonaciones: {
      n: Number(condonaciones?.n || 0),
      total: H.redondear(Number(condonaciones?.total || 0)),
    },
  };
};

// Ranking de morosos: saldo + mora de los préstamos vencidos.
const rankingMorosos = async (args?: { limite?: number; moneda?: string }) => {
  const db = await getDb();
  const dets = await H.detallesPrestamos(await db.getAllAsync(`${SELECT_PRE}`));
  const morosos = dets
    .filter((p) => p.estadoCalc === "atrasado" && p.totalAdeudado > 0)
    .filter((p) => !args?.moneda || p.moneda === args.moneda)
    .sort((a, b) => b.totalAdeudado - a.totalAdeudado || b.diasVencido - a.diasVencido)
    .slice(0, Math.max(1, Math.min(100, Number(args?.limite) || 20)));
  return {
    items: morosos,
    total: morosos.length,
    moraTotal: H.redondear(morosos.reduce((a: number, p: any) => a + p.mora, 0)),
    saldoTotal: H.redondear(morosos.reduce((a: number, p: any) => a + p.saldo, 0)),
  };
};

// Cierre de mes: arg "YYYY-MM".
const cierreDeMes = async (args: { mes?: string }) => {
  const db = await getDb();
  const mes = /^\d{4}-\d{2}$/.test(args?.mes || "") ? args.mes! : H.hoy().slice(0, 7);
  const desde = `${mes}-01`;
  const hasta = `${mes}-31`;

  const cobrado: any[] = await db.getAllAsync(
    `SELECT COALESCE(pr.moneda, 'BS') AS moneda, COALESCE(SUM(pg.monto), 0) AS total, COUNT(*) AS n
     FROM pagos pg LEFT JOIN prestamos pr ON pr.id = pg.prestamoId
     WHERE pg.fecha BETWEEN ? AND ? GROUP BY moneda`,
    desde,
    hasta
  );
  const condonado: any = await db.getFirstAsync(
    "SELECT COALESCE(SUM(monto), 0) AS total, COUNT(*) AS n FROM pagos WHERE notas LIKE 'Condonación%' AND fecha BETWEEN ? AND ?",
    desde,
    hasta
  );
  const nuevosPrestamos: any[] = await db.getAllAsync(
    `SELECT moneda, COUNT(*) AS n, COALESCE(SUM(monto), 0) AS capital,
            COALESCE(SUM(monto * (1 + tasaInteres / 100)), 0) AS deuda
     FROM prestamos WHERE fechaPrestamo BETWEEN ? AND ? GROUP BY moneda`,
    desde,
    hasta
  );
  const prestamosMes: any[] = await db.getAllAsync(
    `${SELECT_PRE} WHERE fechaPrestamo BETWEEN ? AND ?`,
    desde,
    hasta
  );
  const saldoFinal = H.redondear(
    prestamosMes.reduce((a: number, p: any) => a + H.deudaTotal(p.monto, p.tasaInteres), 0)
  );
  const pagadoDelMes = cobrado.reduce((a: number, r: any) => a + Number(r.total || 0), 0);
  const carteraViva = await H.detallesPrestamos(
    await db.getAllAsync(`${SELECT_PRE} WHERE estado != 'pagado'`)
  );
  return {
    mes,
    desde,
    hasta: `${mes}-31`,
    cobradoPorMoneda: cobrado.map((r) => ({ moneda: r.moneda, total: H.redondear(r.total || 0), n: r.n })),
    cobradoTotal: H.redondear(pagadoDelMes),
    condonaciones: { n: Number(condonado?.n || 0), total: H.redondear(Number(condonado?.total || 0)) },
    nuevosPorMoneda: nuevosPrestamos.map((r) => ({
      moneda: r.moneda,
      n: r.n,
      capital: H.redondear(r.capital || 0),
      interesGenerado: H.redondear((r.deuda || 0) - (r.capital || 0)),
    })),
    saldoTeorico: saldoFinal,
    carteraViva: H.redondear(
      carteraViva
        .filter((p) => p.estadoCalc !== "pagado")
        .reduce((a: number, p: any) => a + p.totalAdeudado, 0)
    ),
    morosos: carteraViva.filter((p) => p.estadoCalc === "atrasado").length,
  };
};

// ───────────────────────────── api local ─────────────────────────────
export const api = {
  auth: {
    login: { key: "auth/login", run: login } satisfies MutationDef,
    registroUsuario: { key: "auth/registroUsuario", run: registroUsuario } satisfies MutationDef,
    disponibilidad: { key: "auth/disponibilidad", run: disponibilidad } satisfies QueryDef,
      cambiarPassword: { key: "auth/cambiarPassword", run: cambiarPassword } satisfies MutationDef,
      cambiarUsuarioAdmin: { key: "auth/cambiarUsuarioAdmin", run: cambiarUsuarioAdmin } satisfies MutationDef,
      adminActual: { key: "auth/adminActual", run: adminActual } satisfies QueryDef,
      },
  clientes: {
    list: { key: "clientes/list", run: clientesList } satisfies QueryDef,
    page: { key: "clientes/page", run: clientesPage } satisfies QueryDef,
    estadoCuenta: { key: "clientes/estadoCuenta", run: estadoCuenta } satisfies QueryDef,
    create: { key: "clientes/create", run: crearCliente } satisfies MutationDef,
    toggleBloqueo: { key: "clientes/toggleBloqueo", run: toggleBloqueo } satisfies MutationDef,
  },
  prestamos: {
    list: { key: "prestamos/list", run: prestamosList } satisfies QueryDef,
    page: { key: "prestamos/page", run: prestamosPage } satisfies QueryDef,
    get: { key: "prestamos/get", run: prestamoGet } satisfies QueryDef,
    create: { key: "prestamos/create", run: crearPrestamo } satisfies MutationDef,
    update: { key: "prestamos/update", run: updatePrestamo } satisfies MutationDef,
    remove: { key: "prestamos/remove", run: eliminarPrestamo } satisfies MutationDef,
    registrarPago: { key: "prestamos/registrarPago", run: registrarPago } satisfies MutationDef,
    eliminarPago: { key: "prestamos/eliminarPago", run: eliminarPago } satisfies MutationDef,
    renovar: { key: "prestamos/renovar", run: renovarPrestamo } satisfies MutationDef,
    condonar: {
      key: "prestamos/condonar",
      run: (args: { id: string; monto?: number; notas?: string }) =>
        registrarPago({
          prestamoId: args.id,
          monto: args.monto ?? 0,
          notas: args.notas,
          condonacion: true,
        }),
    } satisfies MutationDef,
  },
  reportes: {
    historialPagos: { key: "reportes/historialPagos", run: pagosHistorial } satisfies QueryDef,
    morosos: { key: "reportes/morosos", run: rankingMorosos } satisfies QueryDef,
    cierreMes: { key: "reportes/cierreMes", run: cierreDeMes } satisfies QueryDef,
    bitacora: { key: "reportes/bitacora", run: bitacoraList } satisfies QueryDef,
  },
  sistema: {
    respaldo: { key: "sistema/respaldo", run: crearRespaldo } satisfies MutationDef,
    respaldos: { key: "sistema/respaldos", run: listarRespaldos } satisfies QueryDef,
    borrarRespaldo: { key: "sistema/borrarRespaldo", run: eliminarRespaldo } satisfies MutationDef,
  },
  solicitudes: {
    pendientes: { key: "solicitudes/pendientes", run: solicitudesPendientes } satisfies QueryDef,
    rechazados: { key: "solicitudes/rechazados", run: solicitudesRechazados } satisfies QueryDef,
    solicitudesPrestamo: { key: "solicitudes/listarSolicitudesPrestamo", run: listarSolicitudesPrestamo } satisfies QueryDef,
    aprobar: { key: "solicitudes/aprobar", run: aprobarSolicitud } satisfies MutationDef,
    rechazar: { key: "solicitudes/rechazar", run: rechazarSolicitud } satisfies MutationDef,
    aprobarSolicitudPrestamo: { key: "solicitudes/aprobarSP", run: aprobarSolicitudPrestamo } satisfies MutationDef,
    rechazarSolicitudPrestamo: { key: "solicitudes/rechazarSP", run: rechazarSolicitudPrestamo } satisfies MutationDef,
    personalizarYAprobar: { key: "solicitudes/personalizarYAprobar", run: personalizarYAprobarSolicitudPrestamo } satisfies MutationDef,
  },
  clientes2: {
    getEstrellas: { key: "clientes2/getEstrellas", run: getEstrellas } satisfies QueryDef,
    actualizarEstrellas: { key: "clientes2/actualizarEstrellas", run: actualizarEstrellas } satisfies MutationDef,
  },
  pagosCliente: {
    list: { key: "pagosCliente/list", run: pagosClienteList } satisfies QueryDef,
    aprobar: { key: "pagosCliente/aprobar", run: aprobarPagoCliente } satisfies MutationDef,
    rechazar: { key: "pagosCliente/rechazar", run: rechazarPagoCliente } satisfies MutationDef,
  },
  notificaciones: {
    list: { key: "notificaciones/list", run: notificacionesList } satisfies QueryDef,
    noLeidas: { key: "notificaciones/noLeidas", run: notificacionesNoLeidas } satisfies QueryDef,
    marcarLeida: { key: "notificaciones/marcarLeida", run: marcarNotificacionLeida } satisfies MutationDef,
    leerTodas: { key: "notificaciones/leerTodas", run: leerTodasNotificaciones } satisfies MutationDef,
    eliminar: { key: "notificaciones/eliminar", run: eliminarNotificacion } satisfies MutationDef,
    vaciar: { key: "notificaciones/vaciar", run: vaciarNotificaciones } satisfies MutationDef,
  },
  recordatorios: {
    vencimientos: { key: "recordatorios/vencimientos", run: vencimientos } satisfies QueryDef,
    enviar: { key: "recordatorios/enviar", run: enviarRecordatorio } satisfies MutationDef,
  },
  settings: {
    getConfig: { key: "settings/getConfig", run: getConfig } satisfies QueryDef,
    getConfigCliente: { key: "settings/getConfigCliente", run: getConfigCliente } satisfies QueryDef,
    updateConfig: { key: "settings/updateConfig", run: updateConfig } satisfies MutationDef,
  },
  interes: {
    list: { key: "interes/list", run: interesesList } satisfies QueryDef,
    actual: { key: "interes/actual", run: interesActual } satisfies QueryDef,
    crear: { key: "interes/crear", run: crearInteres } satisfies MutationDef,
    actualizar: { key: "interes/actualizar", run: actualizarInteres } satisfies MutationDef,
    eliminar: { key: "interes/eliminar", run: eliminarInteres } satisfies MutationDef,
  },
  portalCliente: {
    me: { key: "portalCliente/me", run: portalMe } satisfies QueryDef,
      perfil: { key: "portalCliente/perfil", run: perfilCliente } satisfies QueryDef,
    guardarPerfil: { key: "portalCliente/guardarPerfil", run: guardarPerfil } satisfies MutationDef,
    misPrestamos: { key: "portalCliente/misPrestamos", run: misPrestamos } satisfies QueryDef,
    misPagos: { key: "portalCliente/misPagos", run: misPagos } satisfies QueryDef,
    misPagosEnviados: { key: "portalCliente/misPagosEnviados", run: misPagosEnviados } satisfies QueryDef,
    historialPagos: { key: "portalCliente/historialPagos", run: historialPagos } satisfies QueryDef,
    resumen: { key: "portalCliente/resumen", run: resumenCliente } satisfies QueryDef,
    calendario: { key: "portalCliente/calendario", run: calendarioCliente } satisfies QueryDef,
    misSolicitudesPrestamo: { key: "portalCliente/misSolicitudesPrestamo", run: misSolicitudesPrestamo } satisfies QueryDef,
    pagar: { key: "portalCliente/pagar", run: pagarCliente } satisfies MutationDef,
    solicitarPrestamo: { key: "portalCliente/solicitarPrestamo", run: solicitarPrestamo } satisfies MutationDef,
    getEstrellas: { key: "portalCliente/getEstrellas", run: getEstrellas } satisfies QueryDef,
  },
  registro: {
    infoRegistro: { key: "registro/infoRegistro", run: infoRegistro } satisfies QueryDef,
    registrar: { key: "registro/registrar", run: registrarSolicitud } satisfies MutationDef,
  },
  summary: {
    summary: { key: "summary/summary", run: summary } satisfies QueryDef,
  },
};
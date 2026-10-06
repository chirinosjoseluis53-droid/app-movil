import * as FileSystem from "expo-file-system/legacy";
import { compartirArchivo } from "./compartir";
import { getDb } from "./sqlite";
import { ahora } from "./helpers";

const carpeta = (): string => `${FileSystem.documentDirectory || ""}respaldos/`;

const asegurarCarpeta = async (): Promise<string> => {
  const dir = carpeta();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
};

const marcaTiempo = (): string => ahora().replace(/[: ]/g, "-");

const existe = async (ruta: string): Promise<boolean> =>
  (await FileSystem.getInfoAsync(ruta)).exists;

export type ResultadoRespaldo = {
  ok: boolean;
  ruta?: string;
  nombre?: string;
  compartido?: boolean;
  bytes?: number;
  error?: string;
};

// Copia compacta de la base (SQLite VACUUM INTO: un solo archivo, sin WAL).
// Si el SQLite del dispositivo no soporta VACUUM INTO, cae a una copia simple.
export async function crearRespaldo(): Promise<ResultadoRespaldo> {
  const db = await getDb();
  const dir = await asegurarCarpeta();
  const nombre = `prestamos-${marcaTiempo()}.db`;
  const destino = `${dir}${nombre}`;
  try {
    await db.execAsync(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);
  } catch {
    try {
      await db.execAsync("PRAGMA wal_checkpoint(TRUNCATE)");
    } catch {}
    const candidatos = [
      `${FileSystem.documentDirectory || ""}SQLite/prestamos.db`,
      `${FileSystem.documentDirectory || ""}prestamos.db`,
    ];
    let origen = "";
    for (const ruta of candidatos) {
      if (await existe(ruta)) {
        origen = ruta;
        break;
      }
    }
    if (!origen) return { ok: false, error: "No se encontró el archivo de la base de datos" };
    await FileSystem.copyAsync({ from: origen, to: destino });
  }
  if (!(await existe(destino))) {
    return { ok: false, error: "No se pudo crear el archivo de respaldo" };
  }
  const info: any = await FileSystem.getInfoAsync(destino);
  let compartido = false;
  try {
    compartido = await compartirArchivo({
      uri: destino,
      titulo: "Respaldo de la base de datos",
      mimeType: "application/octet-stream",
      uti: "public.database",
    });
  } catch {}
  return { ok: true, ruta: destino, nombre, compartido, bytes: info.size || 0 };
}

export type RespaldoInfo = { nombre: string; ruta: string; fecha: string; bytes: number };

export async function listarRespaldos(): Promise<RespaldoInfo[]> {
  const dir = carpeta();
  if (!(await existe(dir))) return [];
  const nombres: string[] = await FileSystem.readDirectoryAsync(dir);
  const out: RespaldoInfo[] = [];
  for (const nombre of nombres.filter((n) => n.endsWith(".db"))) {
    const ruta = `${dir}${nombre}`;
    const info: any = await FileSystem.getInfoAsync(ruta);
    if (!info.exists) continue;
    const fecha = info.modificationTime
      ? new Date(info.modificationTime * 1000)
      : new Date(0);
    out.push({
      nombre,
      ruta,
      fecha: `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(
        fecha.getDate()
      ).padStart(2, "0")} ${String(fecha.getHours()).padStart(2, "0")}:${String(
        fecha.getMinutes()
      ).padStart(2, "0")}`,
      bytes: info.size || 0,
    });
  }
  return out.sort((a, b) => b.nombre.localeCompare(a.nombre));
}

export async function eliminarRespaldo(args: { ruta: string }): Promise<{ ok: boolean }> {
  const dir = carpeta();
  if (!args.ruta.startsWith(dir)) throw new Error("Ruta no válida");
  if (await existe(args.ruta)) {
    await FileSystem.deleteAsync(args.ruta, { idempotent: true });
  }
  return { ok: true };
}

export function pesoLegible(bytes: number): string {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

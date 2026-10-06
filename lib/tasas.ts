// Tasas de cambio del día consultadas directamente a fuentes públicas,
// ya que el app móvil no tiene servidor propio.

export type Moneda = {
  codigo: string;
  nombre: string;
  bandera: string;
  valor: number;
  origen: string;
  referencia: boolean;
};

export type ResultadoTasas = {
  momento: string;
  online: boolean;
  monedas: Moneda[];
};

// Valores de respaldo para mostrar aunque no haya internet.
const RESPALDO: Record<string, number> = {
  VES: 855.66,
  CLP: 962.56,
  COP: 3264.54,
};

const conTiempo = async <T,>(ms: number, tarea: () => Promise<T>): Promise<T> => {
  let fin: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      tarea(),
      new Promise<T>((_, rechazar) => {
        fin = setTimeout(() => rechazar(new Error("timeout")), ms);
      }),
    ]);
  } finally {
    if (fin) clearTimeout(fin);
  }
};

const pedirJson = async (url: string, ms = 9000): Promise<any> => {
  const res = await conTiempo(ms, () => fetch(url, { headers: { Accept: "application/json" } }));
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.json();
};

const redondear = (n: number) => Math.round(n * 100) / 100;

// ── Bolívar: dolarapi responde 200; pydolar se intenta como alternativa ──
async function tasaBolivar(): Promise<number> {
  try {
    const dolarapi = await pedirJson("https://ve.dolarapi.com/v1/dolares/oficial");
    const p =
      Number(dolarapi?.promedio) || Number(dolarapi?.promedial) || Number(dolarapi?.valor);
    if (p > 0) return p;
  } catch {
    // se intenta la siguiente fuente
  }

  const pydolar = await pedirJson(
    "https://pydolarvenezuela-api.vercel.app/api/v1/dollar/page?page=bcv"
  );
  const precio = pydolar?.monitors?.usd?.price;
  if (precio > 0) return Number(precio);
  throw new Error("ninguna fuente devolvió el bolívar");
}

// ── Tasas de los países: exchangerate-api + bolívar ───────────────────────
async function tasasPaises() {
  const datos = await pedirJson("https://api.exchangerate-api.com/v4/latest/USD");
  const r = datos?.rates || {};
  const bcv = await tasaBolivar();
  return { bcv, clp: r.CLP, cop: r.COP };
}

export async function obtenerTasas(): Promise<ResultadoTasas> {
  const momento = new Date().toISOString();
  let bcv = 0;
  let clp: number | undefined;
  let cop: number | undefined;
  let origen = "";
  let online = false;

  try {
    const t = await conTiempo(12000, () => tasasPaises());
    bcv = t.bcv;
    clp = t.clp;
    cop = t.cop;
    origen = "BCV / exchangerate-api";
    online = true;
  } catch {
    // sin red: se muestran los valores de respaldo
    bcv = RESPALDO.VES;
    clp = RESPALDO.CLP;
    cop = RESPALDO.COP;
    origen = "valores de referencia (sin conexión)";
  }

  const monedas: Moneda[] = [
    {
      codigo: "USD",
      nombre: "Dólar estadounidense",
      bandera: "🇺🇸",
      valor: 1,
      origen,
      referencia: true,
    },
    {
      codigo: "VES",
      nombre: "Bolívar",
      bandera: "🇻🇪",
      valor: redondear(bcv || RESPALDO.VES),
      origen,
      referencia: false,
    },
    {
      codigo: "CLP",
      nombre: "Peso chileno",
      bandera: "🇨🇱",
      valor: redondear(Number(clp) || RESPALDO.CLP),
      origen,
      referencia: false,
    },
    {
      codigo: "COP",
      nombre: "Peso colombiano",
      bandera: "🇨🇴",
      valor: redondear(Number(cop) || RESPALDO.COP),
      origen,
      referencia: false,
    },
  ];

  return { momento, online, monedas };
}

export function formatearTasa(m: Moneda): string {
  if (m.codigo === "USD") return "$1.00";
  if (m.codigo === "VES") return `Bs. ${m.valor.toLocaleString("es-VE", { minimumFractionDigits: 2 })}`;
  return `${m.valor.toLocaleString("es-CL", { maximumFractionDigits: 0 })}`;
}

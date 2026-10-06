import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import { base64DesdeBytes, crearXLSX, HojaXLSX } from "./xlsx";
import { compartir, hoyISO } from "./reportes";

export type PrestamoReporte = {
  _id: string;
  nombre: string;
  cedula?: string;
  telefono?: string;
  monto: number;
  tasaInteres: number;
  moneda: string;
  fechaPrestamo: string;
  fechaVencimiento: string;
  estadoCalc: string;
  totalPagos: number;
  saldo: number;
  mora: number;
  totalAdeudado: number;
  diasVencido?: number;
};

export type TotalesMoneda = {
  moneda: string;
  prestamos: number;
  montos: number;
  pagado: number;
  saldo: number;
  mora: number;
  adeudado: number;
};

export const ORDEN_MONEDAS = ["BS", "USD", "EUR", "COP", "CLP"];

const num = (n: number) => (Number(n) || 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fechaCorta = (iso?: string) => {
  if (!iso) return "-";
  const [f] = String(iso).split("T");
  const [a, m, d] = f.split("-");
  return `${d}/${m}/${a}`;
};

export function totalesPorMoneda(filas: PrestamoReporte[]): TotalesMoneda[] {
  const mapa = new Map<string, TotalesMoneda>();
  for (const p of filas) {
    const m = p.moneda || "BS";
    const inicial: TotalesMoneda = { moneda: m, prestamos: 0, montos: 0, pagado: 0, saldo: 0, mora: 0, adeudado: 0 };
    const t = mapa.get(m) || inicial;
    t.prestamos += 1;
    t.montos += Number(p.monto) || 0;
    t.pagado += Number(p.totalPagos) || 0;
    t.saldo += Number(p.saldo) || 0;
    t.mora += Number(p.mora) || 0;
    t.adeudado += Number(p.totalAdeudado) || 0;
    mapa.set(m, t);
  }
  return [...mapa.values()].sort(
    (a, b) => ORDEN_MONEDAS.indexOf(a.moneda) - ORDEN_MONEDAS.indexOf(b.moneda)
  );
}

const nombreArchivo = (negocio: string) =>
  (negocio || "prestamos").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "prestamos";

async function asegurarCarpeta() {
  const base = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!base) throw new Error("No hay carpeta disponible para guardar el archivo");
  const dir = `${base}reportes/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  return dir;
}

export async function exportarPrestamosXLSX(
  filas: PrestamoReporte[],
  negocio: string,
  etiqueta: string
) {
  const dir = await asegurarCarpeta();
  const archivo = `${dir}${nombreArchivo(negocio)}-${hoyISO()}.xlsx`;
  const totales = totalesPorMoneda(filas);

  const hojas: HojaXLSX[] = [
    {
      name: "Préstamos",
      title: `${negocio} · ${etiqueta}`,
      headers: [
        "Cliente", "Cédula", "Teléfono", "Moneda", "Monto", "Tasa %",
        "Préstamo", "Vencimiento", "Estado", "Pagado", "Saldo", "Mora", "Total adeudado",
      ],
      types: ["text", "text", "text", "text", "num", "pct", "text", "text", "text", "num", "num", "num", "num"],
      color: "FF1F4E78",
      rows: filas.map((p) => [
        p.nombre || "-",
        p.cedula || "-",
        p.telefono || "-",
        p.moneda || "BS",
        Number(p.monto) || 0,
        Number(p.tasaInteres) || 0,
        fechaCorta(p.fechaPrestamo),
        fechaCorta(p.fechaVencimiento),
        p.estadoCalc || "-",
        Number(p.totalPagos) || 0,
        Number(p.saldo) || 0,
        Number(p.mora) || 0,
        Number(p.totalAdeudado) || 0,
      ]),
    },
    {
      name: "Por moneda",
      title: "Totales por moneda",
      headers: ["Moneda", "Préstamos", "Monto prestado", "Pagado", "Saldo", "Mora", "Total adeudado"],
      types: ["text", "int", "num", "num", "num", "num", "num"],
      color: "FF2E75B6",
      rows: totales.map((t) => [
        t.moneda,
        t.prestamos,
        t.montos,
        t.pagado,
        t.saldo,
        t.mora,
        t.adeudado,
      ]),
    },
  ];

  await FileSystem.writeAsStringAsync(archivo, base64DesdeBytes(crearXLSX(hojas)), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return compartir(archivo, "Reporte de préstamos (Excel)", "spreadsheetml.sheet");
}

function html(filas: PrestamoReporte[], negocio: string, etiqueta: string) {
  const totales = totalesPorMoneda(filas);
  const filasHtml = filas
    .map(
      (p, i) => `<tr class="${i % 2 ? "alt" : ""}">
      <td>${p.nombre || "-"}</td>
      <td>${p.moneda}</td>
      <td class="n">${num(p.monto)}</td>
      <td class="n">${num(p.tasaInteres)}%</td>
      <td>${fechaCorta(p.fechaVencimiento)}</td>
      <td>${p.estadoCalc}</td>
      <td class="n">${num(p.saldo)}</td>
      <td class="n">${num(p.totalAdeudado)}</td>
    </tr>`
    )
    .join("");

  const kpis = totales
    .map(
      (t) => `<div class="kpi"><div class="l">${t.moneda} por cobrar</div><div class="v">${num(t.adeudado)}</div></div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Roboto, "Segoe UI", Arial, sans-serif; color: #1b2733; font-size: 11px; margin: 22px; }
  h1 { font-size: 19px; margin: 0 0 2px; color: #1F4E78; }
  .sub { color: #6b7a8c; margin-bottom: 14px; font-size: 10px; }
  .kpis { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
  .kpi { flex: 1; min-width: 110px; border: 1px solid #C7CDD6; border-radius: 6px; padding: 8px 10px; }
  .kpi .l { font-size: 9px; color: #6b7a8c; text-transform: uppercase; letter-spacing: .3px; }
  .kpi .v { font-size: 15px; font-weight: bold; color: #1F4E78; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1F4E78; color: #fff; text-align: left; padding: 6px 7px; font-size: 10px; }
  td { border: 1px solid #C7CDD6; padding: 5px 7px; }
  tr.alt td { background: #F2F6FA; }
  .n { text-align: right; }
  .vacio { padding: 18px; text-align: center; color: #6b7a8c; border: 1px solid #C7CDD6; }
  .pie { margin-top: 14px; font-size: 9px; color: #8a97a6; border-top: 1px solid #C7CDD6; padding-top: 7px; }
</style></head>
<body>
  <h1>Reporte de préstamos</h1>
  <div class="sub">${negocio || "Mi Negocio de Prestamos"} · ${etiqueta} · ${filas.length} préstamos</div>
  <div class="kpis">${kpis || '<div class="vacio">Sin datos</div>'}</div>
  ${
    filas.length
      ? `<table><thead><tr><th>Cliente</th><th>Mon.</th><th class="n">Monto</th><th class="n">Tasa</th><th>Vence</th><th>Estado</th><th class="n">Saldo</th><th class="n">Total</th></tr></thead><tbody>${filasHtml}</tbody></table>`
      : `<div class="vacio">No hay préstamos en este filtro.</div>`
  }
  <div class="pie">Generado el ${fechaCorta(hoyISO())} · Documento sin valor fiscal</div>
</body></html>`;
}

export async function exportarPrestamosPDF(
  filas: PrestamoReporte[],
  negocio: string,
  etiqueta: string
) {
  const { uri } = await Print.printToFileAsync({ html: html(filas, negocio, etiqueta) });
  return compartir(uri, "Reporte de préstamos (PDF)", "pdf");
}

import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import { compartirArchivo } from "./compartir";
import { base64DesdeBytes, crearXLSX, HojaXLSX } from "./xlsx";
import { FilaPago, ResumenPagos, resumenDesdePagos } from "./resumen-pagos";

export type { FilaPago, ResumenPagos };
export { resumenDesdePagos };

const carpeta = () => {
  const base = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!base) throw new Error("No hay carpeta disponible para guardar el archivo");
  return `${base}reportes/`;
};

const dosDigitos = (n: number) => String(n).padStart(2, "0");

export const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
};

const fechaCorta = (iso: string) => {
  if (!iso) return "";
  const [f] = String(iso).split("T");
  const [a, m, d] = f.split("-");
  return `${d}/${m}/${a}`;
};

const num = (n: number) => n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function asegurarCarpeta() {
  const dir = carpeta();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  return dir;
}

// ───────────────────────────── Excel ─────────────────────────────
export async function exportarPagosXLSX(r: ResumenPagos) {
  const dir = await asegurarCarpeta();
  const archivo = `${dir}resumen-pagos-${hoyISO()}.xlsx`;

  const hojas: HojaXLSX[] = [
    {
      name: "Resumen",
      title: `Resumen de pagos · ${r.cliente || "Cliente"}`,
      headers: ["Fecha", "Referencia", "Método", "Monto", "Saldo restante", "Estado", "Concepto"],
      types: ["text", "text", "text", "num", "num", "text", "text"],
      color: "FF1F4E78",
      rows: r.pagos.map((p) => [
        fechaCorta(p.fecha),
        p.referencia || "-",
        p.metodo || "-",
        Number(p.monto) || 0,
        Number(p.saldo) || 0,
        p.estado || "-",
        p.concepto || "-",
      ]),
    },
    {
      name: "Totales",
      title: "Resumen del período",
      headers: ["Concepto", "Valor"],
      types: ["text", "text"],
      color: "FF2E75B6",
      rows: [
        ["Cliente", r.cliente || "-"],
        ["Cédula", r.cedula || "-"],
        ["Desde", fechaCorta(r.desde)],
        ["Hasta", fechaCorta(r.hasta)],
        ["Cantidad de pagos", r.cantidad],
        ["Total pagado", Number(r.total.toFixed(2))],
        ["Pago promedio", Number(r.promedio.toFixed(2))],
        ["Pago más alto", Number(r.mayor.toFixed(2))],
      ],
    },
  ];

  await FileSystem.writeAsStringAsync(archivo, base64DesdeBytes(crearXLSX(hojas)), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return compartir(archivo, "Resumen de pagos (Excel)", "spreadsheetml.sheet");
}

// ───────────────────────────── PDF ─────────────────────────────
function htmlReporte(r: ResumenPagos) {
  const filas = r.pagos
    .map(
      (p, i) => `<tr class="${i % 2 ? "alt" : ""}">
      <td>${fechaCorta(p.fecha)}</td>
      <td>${p.referencia || "-"}</td>
      <td>${p.metodo || "-"}</td>
      <td class="n">${num(Number(p.monto) || 0)}</td>
      <td>${p.estado || "-"}</td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Roboto, "Segoe UI", Arial, sans-serif; color: #1b2733; font-size: 11px; margin: 22px; }
  h1 { font-size: 19px; margin: 0 0 2px; color: #1F4E78; }
  .sub { color: #6b7a8c; margin-bottom: 14px; font-size: 10px; }
  .filtros { background: #F2F6FA; border-left: 4px solid #1F4E78; padding: 9px 12px; margin-bottom: 14px; }
  .filtros b { color: #1F4E78; }
  .kpis { display: flex; gap: 8px; margin-bottom: 16px; }
  .kpi { flex: 1; border: 1px solid #C7CDD6; border-radius: 6px; padding: 8px 10px; }
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
  <h1>Resumen de pagos</h1>
  <div class="sub">${r.cliente || "Cliente"}${r.cedula ? ` · C.I. ${r.cedula}` : ""}</div>
  <div class="filtros">Periodo: <b>${fechaCorta(r.desde)}</b> al <b>${fechaCorta(r.hasta)}</b></div>
  <div class="kpis">
    <div class="kpi"><div class="l">Total pagado</div><div class="v">${num(r.total)}</div></div>
    <div class="kpi"><div class="l">Pagos</div><div class="v">${r.cantidad}</div></div>
    <div class="kpi"><div class="l">Promedio</div><div class="v">${num(r.promedio)}</div></div>
    <div class="kpi"><div class="l">Pago mayor</div><div class="v">${num(r.mayor)}</div></div>
  </div>
  ${
    r.pagos.length
      ? `<table><thead><tr><th>Fecha</th><th>Referencia</th><th>Método</th><th class="n">Monto</th><th>Estado</th></tr></thead><tbody>${filas}</tbody></table>`
      : `<div class="vacio">No hay pagos registrados en este periodo.</div>`
  }
  <div class="pie">Generado el ${fechaCorta(hoyISO())} · Documento sin valor fiscal</div>
</body></html>`;
}

export async function exportarPagosPDF(r: ResumenPagos) {
  const { uri } = await Print.printToFileAsync({ html: htmlReporte(r) });
  return compartir(uri, "Resumen de pagos (PDF)", "pdf");
}

// ───────────────────────────── Compartir ─────────────────────────────
export async function compartir(uri: string, titulo: string, mime: "pdf" | "spreadsheetml.sheet") {
  return compartirArchivo({ uri, titulo, mime });
}

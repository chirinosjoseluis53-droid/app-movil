// Plantilla HTML del recibo de pago del cliente.
// Se mantiene aparte del componente para poder reutilizarla (portal y admin)
// y para revisarla en un navegador sin levantar la app.

export type DatosRecibo = {
  negocio: string;
  cliente: string;
  numero: string;
  emitidoISO: string;
  estado: string;
  monto: string;
  fechaPago: string;
  metodo: string;
  referencia: string;
  concepto: string;
  prestamo: string;
  saldo: number;
  saldoTexto: string;
};

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const sello = (estado?: string) => {
  const e = String(estado || "").toLowerCase();
  if (e === "aprobado") return { txt: "APLICADO", bg: "#E7F6EF", fg: "#0E7C5A" };
  if (e === "pendiente") return { txt: "EN REVISIÓN", bg: "#FFF4E0", fg: "#9A6208" };
  if (e === "rechazado") return { txt: "RECHAZADO", bg: "#FDE7E7", fg: "#B3261E" };
  return { txt: String(estado || "REGISTRADO").toUpperCase(), bg: "#EEF3F8", fg: "#1F4E78" };
};

const dosCifras = (n: number) => String(n).padStart(2, "0");

export function reciboHtml(d: DatosRecibo): string {
  const s = sello(d.estado);
  const emitido = new Date(d.emitidoISO);

  const fila = (label: string, valor: unknown) => `
    <tr>
      <td class="k">${esc(label)}</td>
      <td class="v">${esc(valor) || "-"}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Roboto, "Segoe UI", Arial, sans-serif; color: #1b2733; font-size: 11px; margin: 26px; }
  .negocio { font-size: 13px; font-weight: bold; color: #1b2733; }
  .mut { color: #6b7a8c; font-size: 9.5px; }
  .cab { width: 100%; border-bottom: 2px solid #1F4E78; padding-bottom: 10px; }
  .cab td { vertical-align: bottom; }
  .der { text-align: right; }
  .doc { font-size: 10px; color: #1F4E78; font-weight: bold; letter-spacing: 1.2px; }
  .sello { display: inline-block; border: 1px solid ${s.fg}; color: ${s.fg}; background: ${s.bg};
           font-size: 9px; font-weight: bold; letter-spacing: .8px; padding: 3px 8px; margin-top: 6px; }
  .monto { margin: 16px 0; border: 1px solid #C7CDD6; border-left: 5px solid #1F4E78; background: #F2F6FA; padding: 12px 14px; }
  .monto .l { font-size: 9px; color: #6b7a8c; text-transform: uppercase; letter-spacing: .8px; }
  .monto .v { font-size: 24px; font-weight: bold; color: #1F4E78; margin-top: 2px; }
  table.detalle { width: 100%; border-collapse: collapse; }
  .detalle th { background: #1F4E78; color: #fff; text-align: left; padding: 6px 8px; font-size: 10px; }
  .detalle td { border: 1px solid #C7CDD6; padding: 6px 8px; vertical-align: top; }
  .detalle .k { width: 34%; background: #F2F6FA; color: #45536b; font-weight: bold; }
  .detalle .v { color: #1b2733; }
  .saldo { margin-top: 12px; border: 1px solid #C7CDD6; padding: 8px 10px; font-size: 10.5px; }
  .saldo b { color: #1F4E78; }
  .firma { margin-top: 28px; width: 100%; }
  .firma td { width: 50%; text-align: center; border-top: 1px solid #8a97a6; padding-top: 5px;
              font-size: 9.5px; color: #6b7a8c; }
  .pie { margin-top: 16px; font-size: 8.5px; color: #8a97a6; border-top: 1px solid #C7CDD6; padding-top: 7px; text-align: center; }
</style></head>
<body>
  <table class="cab"><tr>
    <td>
      <div class="negocio">${esc(d.negocio)}</div>
      <div class="mut" style="margin-top: 3px;">Comprobante de pago</div>
      <div class="mut" style="margin-top: 4px;">Cliente: <b>${esc(d.cliente)}</b></div>
    </td>
    <td class="der">
      <div class="doc">RECIBO DE PAGO</div>
      <div class="mut" style="margin-top: 4px;">N.º ${esc(d.numero)}</div>
      <div class="mut">Emitido: ${esc(d.fechaPago || "")}</div>
      <div class="sello">${esc(s.txt)}</div>
    </td>
  </tr></table>

  <div class="monto">
    <div class="l">Monto pagado</div>
    <div class="v">${esc(d.monto)}</div>
  </div>

  <table class="detalle">
    <thead><tr><th colspan="2">Detalle de la operación</th></tr></thead>
    <tbody>
      ${fila("Fecha del pago", d.fechaPago)}
      ${fila("Método de pago", d.metodo)}
      ${fila("Referencia / comprobante", d.referencia || "N/A")}
      ${fila("Concepto", d.concepto || "Abono a préstamo")}
      ${d.prestamo ? fila("Préstamo asociado", d.prestamo) : ""}
    </tbody>
  </table>

  ${
    d.saldo > 0
      ? `<div class="saldo">Saldo restante del préstamo después de este abono: <b>${esc(d.saldoTexto)}</b></div>`
      : `<div class="saldo">Este abono deja el préstamo <b>cancelado</b>.</div>`
  }

  <table class="firma"><tr>
    <td>Firma del cliente</td>
    <td>Sello y firma de la empresa</td>
  </tr></table>

  <div class="pie">
    Documento generado electrónicamente el ${dosCifras(emitido.getDate())}/${dosCifras(
    emitido.getMonth() + 1
  )}/${emitido.getFullYear()} a las ${dosCifras(emitido.getHours())}:${dosCifras(
    emitido.getMinutes()
  )} · Comprobante válido como respaldo del pago, sin valor fiscal.
  </div>
</body></html>`;
}

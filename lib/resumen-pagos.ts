// Lógica pura del resumen de pagos (sin dependencias nativas) para poder
// probarla fuera del dispositivo.

export type FilaPago = {
  fecha: string;
  referencia: string;
  metodo: string;
  monto: number;
  saldo: number;
  estado: string;
  concepto: string;
};

export type ResumenPagos = {
  cliente: string;
  cedula: string;
  desde: string;
  hasta: string;
  pagos: FilaPago[];
  total: number;
  cantidad: number;
  promedio: number;
  mayor: number;
};

export function resumenDesdePagos(
  cliente: string,
  cedula: string,
  desde: string,
  hasta: string,
  pagos: FilaPago[]
): ResumenPagos {
  const d = String(desde || "").slice(0, 10);
  const h = String(hasta || "").slice(0, 10);
  const dentro = pagos.filter((p) => {
    const f = String(p.fecha || "").slice(0, 10);
    if (!f) return false;
    if (d && f < d) return false;
    if (h && f > h) return false;
    return true;
  });
  const orden = dentro.slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  const total = orden.reduce((a, p) => a + (Number(p.monto) || 0), 0);
  return {
    cliente,
    cedula,
    desde: d,
    hasta: h,
    pagos: orden,
    total,
    cantidad: orden.length,
    promedio: orden.length ? total / orden.length : 0,
    mayor: orden.reduce((a, p) => Math.max(a, Number(p.monto) || 0), 0),
  };
}

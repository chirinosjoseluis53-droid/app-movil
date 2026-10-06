import * as FileSystem from "expo-file-system/legacy";

// expo-print deja el PDF en su carpeta interna de caché (cache/Print/) y ese
// archivo no siempre resulta legible en Android: por eso lo pedimos en base64
// y lo escribimos nosotros. El base64 llega en `result.base64` (no en `uri`,
// que sigue siendo la ruta del archivo) y hay que validarlo antes de compartir.

const carpeta = () =>
  `${FileSystem.documentDirectory || FileSystem.cacheDirectory || ""}facturas/`;

// según la versión, el base64 puede venir en `base64`, embebido en `uri` como
// data URL, o URL-escapado con saltos de línea.
function extraerBase64(res: any): string {
  let b64 = String(res?.base64 || "");
  if (!b64) {
    const uri = String(res?.uri || "");
    b64 = uri.includes(",") && uri.startsWith("data:") ? uri.slice(uri.indexOf(",") + 1) : "";
  }
  b64 = b64.replace(/\s/g, "");
  if (b64.includes("%")) {
    try {
      b64 = decodeURIComponent(b64);
    } catch {}
  }
  return b64;
}

export async function crearPdf(html: string, nombre: string): Promise<string> {
  const { printToFileAsync } = await import("expo-print");

  const dir = carpeta();
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

  const base = String(nombre || "documento").replace(/[^a-zA-Z0-9._-]/g, "_");
  const destino = `${dir}${base}.pdf`;
  try {
    await FileSystem.deleteAsync(destino, { idempotent: true });
  } catch {}

  const res = await printToFileAsync({ html, base64: true });
  const base64 = extraerBase64(res);
  if (base64.length < 100) throw new Error("expo-print devolvió un PDF vacío");

  await FileSystem.writeAsStringAsync(destino, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const info = (await FileSystem.getInfoAsync(destino)) as any;
  const bytes = info?.size || 0;
  // un PDF real pesa bastante más de 1 KB
  if (!info.exists || bytes < 1024) {
    throw new Error(`El PDF generado está incompleto (${bytes} bytes)`);
  }

  // el temporal de expo-print ya está copiado: no lo dejamos ocupando caché
  try {
    if (res?.uri) await FileSystem.deleteAsync(res.uri, { idempotent: true });
  } catch {}

  return destino;
}

// Última instancia: el diálogo nativo de impresión, donde el usuario puede
// guardar el documento como PDF sin depender de la caché ni del compartir.
export async function imprimirHtml(html: string) {
  const { printAsync } = await import("expo-print");
  await printAsync({ html });
}

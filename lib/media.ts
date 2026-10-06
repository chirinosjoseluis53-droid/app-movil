import * as FileSystem from "expo-file-system/legacy";

export const storageUrl = (id?: string | null): string | undefined =>
  id && id.length ? id : undefined;

// Copia una imagen elegida a la carpeta de documentos de la app para que
// sobreviva a reinicios. Si falla, devuelve el URI original.
export async function persistLocalImage(uri: string, carpeta: string): Promise<string> {
  try {
    const base = FileSystem.documentDirectory || "";
    const dir = `${base}media/${carpeta}/`;
    // Ya está guardada en la app: no se copia de nuevo.
    if (base && uri.startsWith(dir)) return uri;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const ext = uri.includes(".")
      ? (uri.split(".").pop() || "jpg").split("?")[0]
      : "jpg";
    const destino = `${dir}${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: destino });
    return destino;
  } catch (e) {
    return uri;
  }
}
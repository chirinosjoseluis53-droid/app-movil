import * as Sharing from "expo-sharing";

// expo-sharing solo permite una comparte activa a la vez (el bloqueo es global
// al módulo nativo, no por pantalla) y en Android la bandera se libera cuando la
// actividad vuelve del diálogo, por lo que una llamada inmediata posterior es
// rechazada con "Another share request is being processed now".
// Serializamos todas las llamadas y reintentamos si el nativo aún no liberó.
let cola: Promise<void> = Promise.resolve();

const esOcupado = (e: unknown) => /another share request/i.test(String((e as any)?.message ?? e));

const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function compartirArchivo(opts: {
  uri: string;
  titulo: string;
  mime?: "pdf" | "spreadsheetml.sheet";
  mimeType?: string;
  uti?: string;
  intentos?: number;
}): Promise<boolean> {
  const { uri, titulo, mime = "pdf", intentos = 3 } = opts;
  if (!(await Sharing.isAvailableAsync())) return false;

  const anterior = cola;
  let liberar!: () => void;
  cola = new Promise<void>((r) => {
    liberar = r;
  });
  await anterior.catch(() => {});

  const enviar = () =>
    Sharing.shareAsync(uri, {
      mimeType: opts.mimeType ?? mime,
      dialogTitle: titulo,
      UTI: opts.uti ?? (mime === "pdf" ? "com.adobe.pdf" : "org.openxmlformats.spreadsheetml.sheet"),
    });

  try {
    for (let intento = 0; ; intento++) {
      try {
        await enviar();
        return true;
      } catch (e) {
        if (!esOcupado(e) || intento >= intentos - 1) throw e;
        await esperar(400 * (intento + 1));
      }
    }
  } finally {
    liberar();
  }
}

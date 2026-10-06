import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Antes la contraseña para el acceso biométrico se guardaba en AsyncStorage
// (texto plano, legible con root/adb). Ahora va en el almacén seguro del
// sistema (Keychain en iOS, EncryptedSharedPreferences en Android).
// Si el binario no trae el módulo nativo, se degrada a AsyncStorage sin fallar.
let secure: any = null;
try {
  secure = require("expo-secure-store");
} catch {
  secure = null;
}

const CLAVE = "credenciales_guardadas";
const CLAVE_LEGACY = "credenciales_biometricas";

export type Credenciales = { user: string; pass: string };

const conSecureStore = (): boolean => !!secure && (Platform.OS === "ios" || Platform.OS === "android");

export async function leerCredenciales(): Promise<Credenciales | null> {
  try {
    if (conSecureStore()) {
      const raw = await secure.getItemAsync(CLAVE);
      if (raw) {
        const parsed = JSON.parse(raw) as Credenciales;
        if (parsed?.user) return parsed;
      }
    }
  } catch {}
  // Respaldo antiguo: se lee, se migra y se borra de AsyncStorage.
  try {
    const viejo = await AsyncStorage.getItem(CLAVE_LEGACY);
    if (viejo) {
      const parsed = JSON.parse(viejo) as Credenciales;
      await AsyncStorage.removeItem(CLAVE_LEGACY);
      if (parsed?.user) {
        await guardarCredenciales(parsed.user, parsed.pass);
        return parsed;
      }
    }
  } catch {}
  return null;
}

export async function guardarCredenciales(user: string, pass: string): Promise<void> {
  const valor = JSON.stringify({ user, pass });
  try {
    if (conSecureStore()) {
      await secure.setItemAsync(CLAVE, valor, {
        keychainAccessible: secure.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      await AsyncStorage.removeItem(CLAVE);
      return;
    }
  } catch {}
  await AsyncStorage.setItem(CLAVE_LEGACY, valor);
}

export async function borrarCredenciales(): Promise<void> {
  try {
    if (conSecureStore()) await secure.deleteItemAsync(CLAVE);
  } catch {}
  try {
    await AsyncStorage.multiRemove([CLAVE, CLAVE_LEGACY]);
  } catch {}
}

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { borrarCredenciales } from "./credenciales";
import type { Id } from "./api";

export type Sesion =
  | {
      rol: "admin";
      username: string;
      userId?: string;
    }
  | {
      rol: "cliente";
      clienteId: Id<"solicitudes">;
      nombre: string;
      userId: string;
      username: string;
      email: string;
      perfilCompleto: boolean;
    }
  | null;

export type DatosSesionCliente = {
  clienteId: Id<"solicitudes">;
  nombre: string;
  userId: string;
  username: string;
  email: string;
  perfilCompleto: boolean;
};

type SesionContextType = {
  sesion: Sesion;
  cargando: boolean;
  iniciarAdmin: (username: string, userId?: string) => Promise<void>;
  iniciarCliente: (datos: DatosSesionCliente) => Promise<void>;
  actualizarCliente: (cambios: Partial<DatosSesionCliente>) => Promise<void>;
  cerrar: () => Promise<void>;
};

const SesionContext = createContext<SesionContextType | null>(null);

const KEY = "sesion_app_movil";

export function SesionProvider({ children }: { children: React.ReactNode }) {
  const [sesion, setSesion] = useState<Sesion>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const s = JSON.parse(raw) as Sesion;
          // Sesiones de cliente antiguas (sin userId) se descartan para
          // que vuelvan a entrar con usuario y contraseña.
          if (s?.rol === "cliente" && !(s as any).userId) {
            await AsyncStorage.removeItem(KEY);
          } else {
            setSesion(s);
          }
        }
      } catch (e) {
        // ignora
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const guardar = useCallback(async (s: Sesion) => {
    setSesion(s);
    if (s) await AsyncStorage.setItem(KEY, JSON.stringify(s));
    else await AsyncStorage.removeItem(KEY);
  }, []);

  const iniciarAdmin = useCallback(
    async (username: string, userId?: string) => {
      await guardar({ rol: "admin", username, userId });
    },
    [guardar]
  );

  const iniciarCliente = useCallback(
    async (datos: DatosSesionCliente) => {
      await guardar({ rol: "cliente", ...datos });
    },
    [guardar]
  );

  const actualizarCliente = useCallback(
    async (cambios: Partial<DatosSesionCliente>) => {
      if (sesion?.rol !== "cliente") return;
      await guardar({ ...sesion, ...cambios });
    },
    [guardar, sesion]
  );

  const cerrar = useCallback(async () => {
    await guardar(null);
    // Cerrar sesión descarta también lo guardado para el acceso biométrico.
    await borrarCredenciales();
  }, [guardar]);

  return (
    <SesionContext.Provider value={{ sesion, cargando, iniciarAdmin, iniciarCliente, actualizarCliente, cerrar }}>
      {children}
    </SesionContext.Provider>
  );
}

export function useSesion(): SesionContextType {
  const ctx = useContext(SesionContext);
  if (!ctx) throw new Error("useSesion debe usarse dentro de SesionProvider");
  return ctx;
}
import React from "react";
import { Redirect } from "expo-router";
import { useSesion } from "../lib/sesion";

export default function Inicio() {
  const { sesion, cargando } = useSesion();
  if (cargando) return null;
  if (sesion?.rol === "admin") return <Redirect href="/(app)/(tabs)" />;
  if (sesion?.rol === "cliente") return <Redirect href="/cliente" />;
  return <Redirect href="/login" />;
}
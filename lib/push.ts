// import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Desactivado temporalmente debido a la limitación de Expo Go en SDK 53
export async function syncOverdueNotifications(overdueCount: number) {
  try {
    // console.log("Notificaciones locales desactivadas en Expo Go.");
  } catch (e) {
    console.log("Error con notificaciones push:", e);
  }
}


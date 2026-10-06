import React from "react";
import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { COLORS } from "../../../lib/ui";

export default function TabsLayout() {
  return (
    <Tabs 
      screenOptions={{ 
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", paddingBottom: 4 },
        headerShown: false,
        tabBarActiveTintColor: COLORS.teal,
        tabBarInactiveTintColor: COLORS.textoSuave,
        tabBarStyle: { 
          backgroundColor: COLORS.blanco, 
          borderTopColor: COLORS.borde, 
          height: 90,
          paddingTop: 12,
          paddingBottom: 36,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="prestamos"
        options={{
          title: "Préstamos",
          tabBarIcon: ({ color }) => <Ionicons name="wallet" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="clientes"
        options={{
          title: "Clientes",
          tabBarIcon: ({ color }) => <Ionicons name="people" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="solicitudes"
        options={{
          title: "Solicitudes",
          tabBarIcon: ({ color }) => <Ionicons name="document-text" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="recordatorios"
        options={{
          title: "Avisos",
          tabBarIcon: ({ color }) => <Ionicons name="notifications" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: "Ajustes",
          tabBarIcon: ({ color }) => <Ionicons name="settings" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
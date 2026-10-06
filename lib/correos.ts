import Constants from "expo-constants";

export async function enviarCorreoAPI(to: string, subject: string, html: string) {
  try {
    let serverIp = 'localhost';
    
    // Si estamos en la app móvil con Expo Go, podemos extraer la IP de la computadora automáticamente
    const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
    
    if (hostUri) {
      serverIp = hostUri.split(':')[0];
    }

    // El servidor Node que acabamos de crear corre en el puerto 3001
    const endpoint = `http://${serverIp}:3001/enviar-correo`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        subject,
        html,
        text: html.replace(/<[^>]+>/g, '') // Fallback simple a texto plano
      }),
    });

    if (!res.ok) {
      throw new Error(`Error en el servidor de correos: ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error("Fallo al enviar correo. ¿Está el servidor backend-correos.js corriendo?:", error);
    return { success: false, error: String(error) };
  }
}

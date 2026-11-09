import type { CapacitorConfig } from '@capacitor/cli';

/**
 * `CAP_DEBUG_REAL=1` arma la variante de prueba contra un backend local por HTTP
 * (`http://10.0.2.2:8100` desde el emulador): el WebView sirve la app en `http://localhost`
 * para no chocar con contenido mixto. Solo la usa `npm run android:apk:real`; el APK normal y
 * el de producción conservan el esquema HTTPS por defecto.
 */
const debugReal = process.env.CAP_DEBUG_REAL === '1';

const config: CapacitorConfig = {
  appId: 'com.axiom.aeronaves',
  appName: 'Aeronaves',
  webDir: 'build',
  ...(debugReal ? { server: { androidScheme: 'http' } } : {}),
};

export default config;

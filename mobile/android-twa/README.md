# APK de Android (TWA con Bubblewrap)

El APK es una Trusted Web Activity: abre https://todo.acuerdalo.cl en pantalla completa con Chrome. Los cambios web llegan sin reinstalar. No se publica en Google Play.

Requisitos: Node 18+, JDK 17 y Android SDK (Bubblewrap ofrece descargarlos la primera vez).

1. Instala Bubblewrap:

   ```bash
   npm i -g @bubblewrap/cli
   ```

2. Desde esta carpeta, inicializa el proyecto. Con el sitio ya desplegado:

   ```bash
   cd mobile/android-twa
   bubblewrap init --manifest https://todo.acuerdalo.cl/manifest.webmanifest
   ```

   Alternativa: usa el `twa-manifest.json` de esta carpeta (`bubblewrap build` lo toma tal cual). Si cambias la ruta de la `signingKey`, déjala FUERA del repo.

3. Crea el keystore **fuera del repo** (por ejemplo en `~/keys/`) y haz una copia de respaldo segura (gestor de contraseñas y un disco aparte). Sin él no puedes firmar actualizaciones:

   ```bash
   keytool -genkeypair -v -keystore ~/keys/acuerdalo-android.keystore -alias acuerdalo \
     -keyalg RSA -keysize 2048 -validity 10000
   ```

   Ajusta `signingKey.path` en `twa-manifest.json` a esa ruta.

4. Compila y firma:

   ```bash
   bubblewrap build
   ```

   Genera `app-release-signed.apk` (y un `.aab`). Estos archivos están en `.gitignore`.

5. Obtén el SHA-256 del keystore:

   ```bash
   keytool -list -v -keystore ~/keys/acuerdalo-android.keystore -alias acuerdalo
   ```

   Copia la línea `SHA256:` y pégala en `frontend/public/.well-known/assetlinks.json`, reemplazando `REEMPLAZAR_CON_SHA256_DEL_KEYSTORE`. Despliega el frontend y comprueba que https://todo.acuerdalo.cl/.well-known/assetlinks.json responde. Sin esto la app muestra la barra de URL.

6. Reparte el `.apk` (Drive, WhatsApp) e instálalo en el teléfono permitiendo "orígenes desconocidos".

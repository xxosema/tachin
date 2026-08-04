# Desplegar TACHÍN en Vercel

Esta carpeta ya tiene todo lo necesario. Sigue estos pasos en orden.

## 0. Antes de nada

- Necesitas una cuenta en [GitHub](https://github.com) y otra en [Vercel](https://vercel.com) (puedes crear la de Vercel iniciando sesión directamente con la de GitHub).
- Necesitas tener **Node.js** instalado en tu Mac (para el paso de migración). Compruébalo con `node --version` en la Terminal — si no sale nada, instálalo desde [nodejs.org](https://nodejs.org).

## 1. Subir el código a GitHub

Abre la Terminal, entra en esta carpeta y crea el repositorio:

```bash
cd ruta/a/esta/carpeta
git init
git add .
git commit -m "Primera versión de la web de Tachín"
```

Ve a [github.com/new](https://github.com/new), crea un repositorio nuevo (puede ser privado) y **no** marques ninguna casilla de "añadir README" (para que no choque con lo que ya tienes). Copia los comandos que te da GitHub bajo "…or push an existing repository from the command line", algo así:

```bash
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git branch -M main
git push -u origin main
```

## 2. Importar el proyecto en Vercel

1. Entra en [vercel.com/new](https://vercel.com/new).
2. Elige "Import" en el repositorio de GitHub que acabas de crear.
3. Framework Preset: déjalo en **Other** (o el que detecte automáticamente, no hace falta tocar nada).
4. Dale a **Deploy**. La primera vez fallará al cargar datos (todavía no hay vinos en Blob) — es normal, lo arreglamos en el siguiente paso.

## 3. Crear el almacén de imágenes/datos (Vercel Blob)

1. En el proyecto ya creado en Vercel, ve a la pestaña **Storage**.
2. **Create Database → Blob** → dale un nombre y **Connect** al proyecto.
3. Esto añade automáticamente la variable de entorno `BLOB_READ_WRITE_TOKEN` — no tienes que copiarla a mano.

## 4. Configurar el usuario, contraseña y clave de sesión del panel

En el proyecto de Vercel: **Settings → Environment Variables**, añade:

| Nombre | Valor |
|---|---|
| `ADMIN_USER` | el usuario que quieras (ej. `tachin`) |
| `ADMIN_PASS` | una contraseña segura, cámbiala del valor de pruebas actual |
| `SESSION_SECRET` | una cadena larga y aleatoria (ej. genera una en [1password.com/password-generator](https://1password.com/password-generator/) o similar, 40+ caracteres) |

`SESSION_SECRET` es importante: es la clave con la que se firma la cookie de sesión del login (`/admin/login`). Si no la configuras, el sitio usa un valor por defecto que está en el código público — cualquiera podría fabricarse una sesión válida sin conocer la contraseña. Configúrala antes de dar por terminado el despliegue.

Guarda y vuelve a desplegar (Deployments → el último → botón "Redeploy") para que las variables se apliquen.

## 5. Subir el catálogo inicial (una sola vez)

Esto sube tus 6 vinos actuales (fotos + datos) al Blob Store. Se hace desde tu Mac, en esta misma carpeta:

```bash
npm install -g vercel      # si no lo tienes ya
vercel link                # conecta esta carpeta a tu proyecto de Vercel (te pedirá elegir cuál)
vercel env pull .env.local # trae el token de Blob a tu máquina
```

Y ahora ejecuta la migración (carga las variables de `.env.local` y las pasa al script):

```bash
export $(grep -v '^#' .env.local | xargs) && node scripts/migrate-to-blob.js
```

Deberías ver "Listo: 6 vinos migrados a Vercel Blob." al final. **No lo vuelvas a ejecutar** una vez hayas empezado a editar el catálogo desde `/admin` — sobrescribiría los cambios con estos datos de partida.

## 6. Comprobar que todo funciona

- Sitio: `https://tu-proyecto.vercel.app`
- Panel: `https://tu-proyecto.vercel.app/admin` (te llevará a una pantalla de login propia con el usuario/contraseña del paso 4)
- Info nutricional: `https://tu-proyecto.vercel.app/informacion-nutricional`

## 7. Conectar tu dominio (tachinadega.com)

En el proyecto de Vercel: **Settings → Domains** → añade `tachinadega.com` (y `www.tachinadega.com` si lo quieres también). Vercel te dará unos registros DNS (normalmente un registro A y/o CNAME) que tienes que dar de alta donde tengas contratado el dominio (el panel de tu proveedor de dominios, no en Vercel). Puede tardar hasta 24-48h en propagarse, aunque normalmente es cuestión de minutos.

Una vez el dominio esté activo, los QR que ya imprimió la otra empresa (`tachinadega.com/informacion-nutricional/...`) funcionarán solos — no hay que hacer nada más, ya están contemplados en `vercel.json`.

## Notas importantes

- **Los cambios desde `/admin` tardan hasta 60 segundos** en verse reflejados en el sitio público (es el mínimo de caché que permite Vercel Blob).
- **Límite de imagen**: unos 4,5MB por subida (tus GIFs actuales están entre 500KB y 700KB, sin problema).
- El archivo `scripts/dev-server.js` es solo para probar en tu Mac sin necesidad de Vercel (`node scripts/dev-server.js` → `http://localhost:4000`). No se sube a producción (está en `.vercelignore`), es una herramienta de desarrollo.
- Si quieres volver a ejecutar la migración desde cero (por ejemplo, para reiniciar el catálogo), tendrás que repetir el paso 5.

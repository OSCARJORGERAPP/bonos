<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md — Guía operativa de Gestión de Bonos Corporativos

> Especificación del producto (el **QUÉ**, requisitos RF-01…RF-10 y métricas): ver `PROMPT.md`. Este archivo es el **CÓMO**.

## 🚀 Instalación (paso a paso)

```bash
# 1. Dependencias (usa el lockfile commiteado; en CI: npm ci)
npm install

# 2. Variables de entorno
cp .env.example .env.local   # y rellenar valores (ver plantilla)
```

Dependencias del dominio (ya en `package.json`): `mongodb`, `jose`, `nodemailer`, `@aws-sdk/client-s3`; dev: `tsx`, `vitest`.

## 🗄️ Servicios locales (Docker)

```bash
# MongoDB
docker run -d --name bonos-mongo -p 27017:27017 mongo:7

# MailHog (SMTP dev; UI en http://localhost:8025)
docker run -d --name bonos-mailhog -p 1025:1025 -p 8025:8025 mailhog/mailhog

# RustFS (storage compatible S3; escucha en 9000 dentro del contenedor)
docker run -d --name bonos-rustfs -p 9001:9000 rustfs/rustfs:latest
```

Variables clave (`.env.local`): `MONGODB_URI=mongodb://localhost:27017/bonos`, SMTP `localhost:1025`, RustFS `http://localhost:9001`, secreto JWT. Plantilla completa en `.env.example`.

Aprovisionar datos de ejemplo (crea también los índices de `PROMPT.md` §6):

```bash
npm run seed          # inserta emisores, bonos, carteras + índices (idempotente)
npm run seed:reset    # limpia la BD y re-siembra
```

## ▶️ Arranque del sistema

```bash
npm run dev              # desarrollo → http://localhost:3000
npm run build && npm start   # producción
npm run lint             # ESLint
```

Magic links de login visibles en MailHog: [http://localhost:8025](http://localhost:8025).

## ✅ Tests

Vitest configurado (`vitest.config.ts`, tests en `tests/`):

```bash
npm test                 # suite completa (unitarios + integración)
npm run test:watch       # desarrollo
npm run test:cov         # cobertura
```

Los tests de integración usan MongoDB/RustFS locales y **se saltan limpiamente** si no están disponibles (p. ej. en el runner de CI). Ojo: `it.skipIf` recibe un booleano, no una función (ver RETROSPECTIVA).

Política: **cada RF de `PROMPT.md` §4 tiene ≥1 test**; los cálculos financieros (flujos, cupones, céntimos/bps) llevan tests unitarios exhaustivos. PR sin tests no se mergea.

## 🧱 Estructura del proyecto

```
app/
  admin/              # emisiones, libro de órdenes, adjudicación, documentos
  investor/           # cartera, screener, alertas
  api/                # auth, bonds, issuers, orders, portfolio, alerts, documents
  context/            # GlobalContext (sesión en cliente)
  components/         # Navbar
  globals.css         # Tailwind v4 (ver reglas CSS abajo)
lib/                  # db.ts (singleton), auth.ts (jose), finance.ts (flujos/precio/YTM),
                      # allocation.ts (prorrateo), alerts.ts, mail.ts, s3.ts, types.ts, format.ts
proxy.ts              # Next 16 (ex-middleware): protege /admin y /investor
scripts/seed.ts       # seed de datos + índices
tests/                # Vitest: finance, allocation, auth, alerts, integración
Dockerfile            # multi-stage standalone (CI de la academia)
```

La lógica de negocio testeable vive en `lib/` (pura, sin Next); las route handlers son finas: validan, autorizan y persisten.

## 🧭 Convenciones

- **Dinero y tasas**: importes siempre en **céntimos** (enteros); tasas/cupones en **puntos básicos**. Nunca `float` para dinero; formatear solo en la capa de presentación.
- **Roles en servidor**: toda ruta admin verifica el rol del JWT en servidor (nunca confiar en el cliente); el inversor solo accede a sus propios datos (RF-09).
- **Acceso a datos**: siempre a través del singleton `lib/db.ts`; sin conexiones ad-hoc. Los pagos programados se **persisten** al adjudicar, no se recalculan al vuelo.
- **TypeScript estricto**; tipos del dominio compartidos entre API y UI.
- **Commits**: mensajes en imperativo, un cambio lógico por commit.
- **Errores**: las API Routes devuelven JSON `{ error }` con status HTTP correcto (400/401/403/404/500); nunca tragarse errores en silencio.

### CSS / Layout (Tailwind v4 — obligatorio)

Tailwind v4 genera sus utilities dentro de `@layer utilities`. Todo CSS escrito **fuera** de un `@layer` en el mismo fichero tiene mayor prioridad en la cascada, independientemente de la especificidad. Un reset global como `* { margin: 0; padding: 0; }` **anula** utilidades como `mx-auto` y rompe el centrado.

1. En `app/globals.css` usar **solo** `*, *::before, *::after { box-sizing: border-box; }` fuera de capas. El preflight de Tailwind ya resetea márgenes/paddings — no duplicar.
2. Para centrar contenido, patrón **contenedor exterior ancho completo + `<div>` interior centrado**:
   ```tsx
   // ✅ Correcto
   <main>
     <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
   </main>

   // ❌ Incorrecto con Tailwind v4 si hay CSS fuera de @layer
   <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
   ```
3. CSS personalizado que toque las mismas propiedades que las utilities → envolverlo en `@layer utilities { ... }`.

## 📊 Métricas (cómo recolectarlas)

Objetivos numéricos en `PROMPT.md` §5; qué se mide en §8.

- **Latencias API**: timers en las API Routes (log estructurado con ruta + ms); agregar p50/p95/p99 desde los logs.
- **MongoDB**: envolver operaciones clave en `lib/db.ts` con timers; `db.bonds.find({...}).explain("executionStats")` para verificar índices del screener.
- **Tamaños**: `db.stats()` y `Object.bsonSize(doc)` en `mongosh` sobre datos del seed.
- **Concurrencia**: TODO — script de carga (autocannon o k6) contra screener y tablero; registrar el punto de degradación.

## 🌐 Deployment público

**TODO** — pendiente de definir plataforma (`PROMPT.md` §9). Esqueleto del proceso:

```bash
# Prerequisitos: secretos de producción en el gestor de la plataforma,
# MongoDB gestionado aprovisionado, SMTP y S3 reales configurados, DNS apuntando.

npm run build                  # build de producción
# TODO: comando de deploy según plataforma

# Verificación post-deployment
curl https://<dominio>/        # TODO: añadir endpoint /health

# Rollback
git revert <commit> && git push   # y re-deploy
```

Pipeline CI en `.gitlab-ci.yml`: basado en los templates compartidos `internos/templates-cicd` de la academia.

### ⚠️ CI en gitlab.codecrypto.academy — lecciones previas (videocapture, RETROSPECTIVA §7-§9)

Restricciones reales de la infraestructura de la academia, ya sufridas y resueltas en el proyecto `videocapture` — respetarlas al tocar `.gitlab-ci.yml`:

1. **No cachear `node_modules/` y a la vez pasarlo como artifacts** entre jobs: con ~400 paquetes y binarios nativos, duplicar compresión/subida/descarga cuelga los jobs o agota el timeout en runners compartidos. Cachear solo `.npm/`.
2. **`timeout:` explícito por job** (build ~15m, lint/test ~10m): un runner degradado debe fallar rápido, no colgarse una hora.
3. **Único runner operativo**: `cloudrun-ephemeral` (tag `cloudrun`), executor **shell** — ignora `image:` (no hay Alpine ni `apk`; node/npm en el host no garantizados). Solo funciona el job `build` de los templates (usa `buildah`), que requiere **Dockerfile multi-stage standalone** y `output: "standalone"` en `next.config.ts`. Jobs sin tag `cloudrun` se quedan en `pending` para siempre.
4. **`wake_cloudrun_runners` / `provision_*` / `deploy` se saltan con `rules: when: never`** (necesitan un runner persistente que no existe). Con `allow_failure: true` el pipeline queda "passed with warnings", no verde limpio.
5. El código debe aceptar tanto variables locales (`MONGODB_URI`, `S3_*`) como las que inyecta la plataforma en runtime (`MONGO_HOST`/`MONGO_PORT`/`MONGO_USER`/`MONGO_PASSWORD`/`MONGO_DB`, `RUSTFS_*`, `BUCKET_NAME`).
6. Si vuelve el síntoma "no runners online": no es un bug del repo — el runner compartido se congela cuando el disco del host se llena de capas Docker; escalar al admin pidiendo `docker system prune -f` + reinicio, citando el precedente de los proyectos `video`/`videocapture`.

## 📦 Repositorios y sincronización

| Repositorio | URL |
|---|---|
| GitHub | `https://github.com/OSCARJORGERAPP/bonos` |
| GitLab | `https://gitlab.codecrypto.academy/ojrapp/bonos` |

Subir solo cuando: pipeline CI verde, tests al 100%, build sin errores y entregables de `PROMPT.md` §7 completos. **Todo push a main se replica en AMBOS remotes** (la fuente de verdad es el local).

## 📒 Documentación viva (obligación del agente)

Tras cada cambio relevante:
- Si cambia instalación/arranque → actualizar `README.md` y `QUICKSTART.md`.
- Cada problema encontrado → entrada **problema → causa → solución** en `RETROSPECTIVA.md`.
- Si cambia el alcance o el stack → re-sincronizar `PROMPT.md` (y su manifiesto §7) con la skill `spec-docs`.
- Al cerrar el proyecto → completar `REFLEXION-FINAL.md`.

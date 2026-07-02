# 💰 Gestión de Bonos Corporativos — Especificación

> Este archivo es el **QUÉ** del proyecto. El **CÓMO** (comandos, convenciones, flujo de trabajo) vive en `AGENTS.md`.

## 1. Objetivo

Aplicación **fintech de deuda corporativa**: el administrador estructura emisiones de bonos y gestiona el libro de órdenes (bookbuilding); el inversor busca bonos en un screener, compra y sigue su cartera.

Con este proyecto el alumno aprende:

- A modelar un **dominio financiero complejo**: nominal, cupón fijo/variable, frecuencia de pago, vencimiento, YTM, rating.
- El proceso de **bookbuilding** (libro de órdenes durante el periodo de oferta).
- A calcular y programar **flujos de pago** (cupones periódicos + devolución del principal).
- Filtros y agregaciones avanzadas en MongoDB para el screener y el dashboard.

## 2. Alcance

**Incluido (MVP):**
- Roles admin e inversor con auth por magic link.
- Estructuración de emisiones, bookbuilding, adjudicación y fijación de precio.
- Compra de bonos, cartera del inversor, calendario de flujos de pago.
- Screener con filtros (rating, YTM, vencimiento, sector).
- Alertas (rating, precio, rebalanceo) vía email (MailHog en dev).
- Documentos (reportes, fiscales) en S3/RustFS.
- Seed de datos de ejemplo.

**Fuera de alcance (por ahora):**
- Mercado secundario entre inversores (solo mercado primario).
- Pagos con dinero real / pasarela de pago.
- Cotizaciones de mercado en tiempo real de fuentes externas.

## 3. Stack tecnológico

| Capa | Tecnología | Estado | Justificación |
|------|------------|--------|---------------|
| Frontend | Next.js 16.2.10 + React 19 + TypeScript + Tailwind v4, `GlobalContext`, `proxy.ts` | ✅ | App Router full-stack, tipado estricto para dominio financiero |
| API | Next.js API Routes (emisiones, órdenes, cartera, alertas, reports) | ✅ | Un solo despliegue, sin backend separado |
| Base de datos | MongoDB **driver nativo** (singleton `lib/db.ts`) | ✅ | Agregaciones flexibles para screener/dashboard; sin ORM para aprender el driver |
| Auth | Magic link con JWT (`jose`) enviado vía MailHog (nodemailer) | ✅ | Sin contraseñas; MailHog para dev local |
| Storage | S3/RustFS para documentos (`@aws-sdk/client-s3`, path-style) | ✅ | API compatible S3 auto-alojada |
| Infra dev | Docker: `mongo:7`, `mailhog/mailhog`, `rustfs/rustfs:latest` (9001→9000) | ✅ | Entorno reproducible |

> Los importes se guardan **en céntimos** y los tipos/tasas **en puntos básicos** (enteros, sin errores de redondeo).

## 4. Requisitos funcionales

Cada RF debe tener ≥1 test automatizado (ver política en `AGENTS.md`).

**Admin**
- **RF-01 Estructuración de la emisión**: crear un bono con valor nominal, tasa de cupón (fija o variable), frecuencia de pagos, vencimiento, empresa emisora y nombre; clasificación por plazo corto/medio/largo. *Aceptación*: el bono queda persistido y visible en el listado del admin con todos sus campos.
- **RF-02 Libro de órdenes (bookbuilding)**: durante el periodo de oferta las órdenes de los inversores se acumulan con precio/cantidad; el admin ve la demanda agregada en tiempo real y fija el precio final antes de adjudicar. *Aceptación*: la demanda agregada refleja todas las órdenes; al cerrar, el precio final queda fijado y las órdenes adjudicadas.
- **RF-03 Automatización de pagos**: al adjudicar, se genera y persiste el calendario de flujos (cupones periódicos + devolución del principal al vencimiento) por inversor. *Aceptación*: para un bono con cupón, frecuencia y vencimiento dados, los pagos programados en BD coinciden con el calendario esperado.
- **RF-04 Cumplimiento y reportes**: subir/consultar documentos fiscales, uso de fondos y covenants asociados a la emisión (almacenados en S3/RustFS). *Aceptación*: un documento subido puede descargarse y queda vinculado a su emisión.

**Investor**
- **RF-05 Screener de bonos**: filtrar por rating crediticio, rendimiento (YTM), vencimiento y sector; comprar bonos. *Aceptación*: cada filtro reduce el resultado correctamente (verificado contra el seed); la compra crea la orden/posición.
- **RF-06 Tablero de posición**: valor de mercado de la cartera, próximos cupones a cobrar y rendimiento histórico. *Aceptación*: los totales del tablero cuadran con las posiciones y pagos programados en BD.
- **RF-07 Alertas**: notificaciones por cambios de rating del emisor, fluctuaciones de precio y rebalanceo. *Aceptación*: un cambio de rating genera la alerta y el email (visible en MailHog).

**Transversales**
- **RF-08 Auth por magic link**: login sin contraseña; JWT firmado con `jose`; enlaces visibles en MailHog (dev). *Aceptación*: el enlace loguea al usuario y expira.
- **RF-09 Roles en servidor**: las rutas de administración comprueban el rol del JWT en servidor; el inversor solo ve sus propias posiciones y órdenes. *Aceptación*: un inversor recibe 403 en rutas admin y no puede leer datos de otro inversor.
- **RF-10 Seed**: genera emisores, bonos con distintos ratings/plazos y carteras de ejemplo para explorar el screener desde el primer momento. *Aceptación*: tras el seed, el screener muestra datos variados sin pasos manuales.

## 5. Requisitos no funcionales (medibles)

| Métrica | Objetivo | Cómo se mide (ver §8) |
|---|---|---|
| Latencia API p95 (endpoints clave: screener, tablero, órdenes) | < 300 ms | logs de instrumentación / script de carga |
| Tiempo de respuesta MongoDB p95 por operación clave | < 50 ms | `explain()` + timers en `lib/db.ts` |
| Accesos concurrentes | ≥ 50 usuarios simultáneos sin degradación > 20% | prueba de carga (TODO: herramienta) |
| Tamaño por documento | bono < 4 KB; orden < 1 KB; pago programado < 0.5 KB | inspección `bsonSize` sobre el seed |
| Tamaño por colección (escenario demo) | < 100 MB total | `db.stats()` |
| Precisión financiera | 0 errores de redondeo (céntimos y puntos básicos, enteros) | tests unitarios de cálculo de flujos |
| Disponibilidad objetivo | TODO (definir al elegir plataforma de deploy) | — |

## 6. Modelo de datos (MongoDB)

Colecciones previstas (importes en céntimos, tasas en puntos básicos):

| Colección | Contenido | Índices previstos |
|---|---|---|
| `users` | email, rol (`admin` \| `investor`) | único `email` |
| `issuers` | empresa emisora, sector, rating vigente | `rating`, `sector` |
| `bonds` | nominal, cupón (fijo/variable, bps), frecuencia, vencimiento, plazo, estado (oferta/adjudicado/vencido), precio final | `rating`, `maturity`, `sector`, `status` (screener) |
| `orders` | libro de órdenes: bono, inversor, precio, cantidad, estado | `bondId+status`, `investorId` |
| `positions` | cartera: bono, inversor, cantidad, coste | `investorId` |
| `payments` | flujos programados: bono, inversor, fecha, tipo (cupón/principal), importe, estado | `investorId+dueDate`, `bondId` |
| `alerts` | tipo (rating/precio/rebalanceo), destinatario, payload, estado de envío | `investorId`, `status` |

Decisión de diseño: **el bono es la entidad central** y los pagos se derivan de él; los pagos programados se **persisten** (no se calculan al vuelo) para simplificar el tablero y las alertas.

## 7. Entregables documentales (OBLIGATORIOS)

Fuente de verdad del estado del proyecto. Estado real verificado a fecha 2026-07-02:

| Entregable | Propósito | Estado |
|---|---|---|
| `README.md` | Visión general, instalación, arranque, arquitectura resumida | ✅ |
| `QUICKSTART.md` | Camino mínimo "de cero a corriendo" en < 5 min | ✅ |
| `RETROSPECTIVA.md` | Bitácora **problema → causa → solución** (entrada por incidente) | ✅ 4 incidentes |
| `REFLEXION-FINAL.md` | Cierre: qué se logró, decisiones, deuda técnica, aprendizajes | ✅ |
| Tests automatizados | ≥1 por RF; unitarios + integración | ✅ 24 tests (Vitest) |
| Seed de datos (`scripts/seed.ts`) | Emisores, bonos, carteras de ejemplo (RF-10) | ✅ `npm run seed` |
| `.env.example` | Plantilla de variables de entorno | ✅ |
| Lockfile (`package-lock.json`) | Dependencias bloqueadas, commiteado | ✅ |
| Pipeline CI (`.gitlab-ci.yml`) | Templates de la academia; `build` en runner `cloudrun` | 🟡 pendiente validar en el primer push |
| Diagrama de arquitectura | En README (Mermaid): componentes y flujos | ✅ |
| Sección de métricas | Instrumentación `timed()` en BD + log estructurado por operación | 🟡 sin prueba de carga |
| Guía de deployment público | Detallada, reproducible, con secretos y rollback | ⬜ TODO (§9: plataforma sin definir) |

## 8. Métricas y observabilidad

- **Qué se mide**: throughput (req/s), latencias p50/p95/p99 de screener/tablero/órdenes, tiempos de MongoDB por operación e índice, tamaño de documentos y colecciones, usuarios concurrentes y punto de degradación, tasa de error, uso CPU/memoria.
- **Cómo**: instrumentación en `lib/db.ts` y en las API Routes (timers + log estructurado); `explain()` sobre las queries del screener; script de carga (TODO: elegir herramienta, p. ej. autocannon/k6); `db.stats()` para tamaños.
- **Umbrales**: los de §5. Comandos concretos en `AGENTS.md` §Métricas.

## 9. Deployment público

- **Entorno objetivo**: TODO — definir plataforma (requiere Node runtime + MongoDB gestionado + SMTP + storage S3; MailHog y RustFS son solo para dev).
- **Dominio**: TODO.
- **Secretos/variables**: las de `.env.example` (`MONGODB_URI`, JWT secret, SMTP, S3/RustFS) gestionadas en el gestor de secretos de la plataforma.
- **Estrategia de actualización**: TODO (rolling por defecto en PaaS).
- **Backup / RPO / RTO**: TODO al elegir el MongoDB gestionado.

Comandos y pasos: ver `AGENTS.md` §Deployment.

## 10. Criterios de aceptación del proyecto

- [ ] Todos los RF (01–10) implementados y con ≥1 test en verde.
- [ ] Todos los entregables de §7 en ✅.
- [ ] Suite de tests al 100% y pipeline CI en verde.
- [ ] `npm run build` sin errores.
- [ ] Seed ejecutable que deja el screener explorable de inmediato.
- [ ] Magic links funcionales visibles en MailHog ([http://localhost:8025](http://localhost:8025)).
- [ ] Métricas de §5 medidas y dentro de objetivo.
- [ ] Proyecto subido y sincronizado en GitHub y GitLab (ver `AGENTS.md` §Repositorios).

# 🎬 Guion del video de entrega — 5:00 min

> Dos secuencias: **funcionamiento** (0:00–2:30) y **código** (2:30–5:00).
> Los tiempos son orientativos por escena; ensayar una vez con cronómetro.

## Preparación (antes de grabar)

```bash
docker start bonos-mongo bonos-mailhog bonos-rustfs
npm run seed:reset        # estado demo limpio
npm run dev
```

Pestañas abiertas en este orden: ① http://localhost:3000 · ② http://localhost:8025 (MailHog) · ③ VS Code · ④ terminal.
Tener a mano un PDF cualquiera para la subida de documentos.

---

## SECUENCIA 1 — Funcionamiento (0:00 – 2:30)

### 0:00–0:15 · Presentación (pestaña ①, pantalla de login)
> "Esta es una aplicación fintech de **deuda corporativa**: el administrador estructura emisiones de bonos y gestiona el libro de órdenes durante el bookbuilding; el inversor busca bonos en un screener, compra y sigue su cartera."

### 0:15–0:35 · Login por magic link (①→②)
- Escribir `ana@inversores.local` → **Enviarme el enlace**.
- Cambiar a MailHog, abrir el email, clic en el enlace → entra al tablero.
> "No hay contraseñas: autenticación por **magic link** con JWT firmado; en desarrollo los emails se ven en MailHog."

### 0:35–1:00 · Tablero del inversor (RF-06)
- Señalar las 4 tarjetas: valor de mercado, coste, cobrado, rendimiento histórico.
- Bajar a posiciones y **próximos cobros** (fechas e importes).
> "El tablero sale de los **pagos persistidos** en MongoDB: al adjudicar un bono se genera el calendario completo de cupones y principal de cada inversor — no se recalcula al vuelo."

### 1:00–1:25 · Screener y compra (RF-05)
- Ir a **Screener** → filtrar rating `A` → quitar filtro → filtrar YTM mínima 5%.
- **Comprar** en "Vulcano 5.0% 2033": 50 títulos a 992,00 € → enviar orden.
> "Filtros por rating, sector, YTM y vencimiento. El precio estimado y la YTM se **derivan del rating del emisor** descontando los flujos. La orden queda pendiente en el libro del bono."

### 1:25–2:00 · Bookbuilding y adjudicación como admin (RF-01/02/03)
- **Salir** → login `admin@bonos.local` (vía MailHog).
- En **Emisiones**, señalar el formulario **Nueva emisión** ("aquí se estructura: nominal, cupón fijo o variable, frecuencia, vencimiento").
- Entrar al **Libro de órdenes** de Vulcano: demanda agregada por precio (está la orden de ana).
- **Adjudicar** a 988,00 € → leer el resultado: órdenes adjudicadas y pagos programados.
> "Solo participan órdenes con precio mayor o igual al final; con sobredemanda hay **prorrateo proporcional**. Al adjudicar se persisten los flujos de pago."

### 2:00–2:30 · Documentos y alertas (RF-04/07)
- En el mismo bono, subir el PDF como "fiscal" y descargarlo → "queda en **RustFS** vía API S3".
- Volver a **Emisiones** → bajar el rating de **NubeTech Systems** a `B` → mensaje "6 alertas generadas".
- Cambiar a MailHog: emails de alertas a bruno y carla; abrir uno.
> "El cambio de rating genera alertas de rating, de precio recalculado y de rebalanceo para los inversores con posiciones, y las envía por email."

---

## SECUENCIA 2 — Código (2:30 – 5:00)

### 2:30–2:50 · Definición y stack (VS Code: `README.md`)
- Mostrar el README con el diagrama.
> "**Qué es**: gestión del ciclo completo de un bono corporativo — emisión, bookbuilding, adjudicación, pagos y seguimiento. **Stack**: Next.js 16 con App Router y TypeScript, Tailwind 4, **MongoDB con driver nativo** sin ORM, auth con `jose`, MailHog para email y RustFS como storage S3. Todo definido como especificación en `PROMPT.md` (el qué) y `AGENTS.md` (el cómo)."

### 2:50–3:15 · Arquitectura (README, diagrama Mermaid)
- Zoom al diagrama.
> "El navegador habla con Next.js, que sirve páginas y API Routes. La API usa un **singleton** del driver de Mongo (`lib/db.ts`), envía emails por SMTP y guarda documentos en RustFS. Dos decisiones clave: **importes en céntimos y tasas en puntos básicos** — enteros, cero errores de redondeo — y **pagos persistidos** al adjudicar."

### 3:15–3:45 · Estructura (VS Code: árbol de carpetas)
- Expandir `app/` y `lib/`.
> "`app/admin` y `app/investor` son las dos zonas de UI, protegidas por `proxy.ts` — la nueva convención de Next 16 que sustituye a middleware — y cada API Route revalida el **rol del JWT en servidor**. Lo importante: la lógica de negocio vive en `lib/` como **funciones puras** — `finance.ts` calcula flujos, precio y YTM; `allocation.ts` el prorrateo; `alerts.ts` las alertas. Las routes solo validan, autorizan y persisten."
- Abrir `lib/allocation.ts` 10 segundos: "el bookbuilding entero es esta función testeable."

### 3:45–4:15 · Tests y cobertura (terminal)
- Ejecutar `npm run test:cov` en vivo (dura ~2s).
> "**24 tests, todos en verde**: unitarios del dominio — calendario de flujos, prorrateo, precisión en céntimos, JWT — e **integración real** contra MongoDB y RustFS, que verifican que el seed cuadra y el roundtrip de documentos. Cobertura de la lógica de dominio: **81% de sentencias**, con `finance` y `alerts` al 100% de líneas. Cada requisito funcional de la especificación tiene al menos un test."

### 4:15–4:35 · Métricas (VS Code: `lib/db.ts` + terminal del dev server)
- Mostrar `timed()` y en la terminal del servidor un log `{"kind":"db","op":"bonds.screener","ms":...}`.
> "Toda operación de BD pasa por `timed()`, que emite un log estructurado con la operación y su latencia — la base para medir los objetivos de la especificación: API p95 bajo 300 ms y Mongo bajo 50 ms. Los índices del screener los crea el seed y se verifican por test."

### 4:35–5:00 · CI y despliegue público (navegador: GitLab pipeline)
- Mostrar https://gitlab.codecrypto.academy/ojrapp/bonos/-/pipelines (pipeline #1463 verde) y el repo de GitHub.
> "El proyecto está sincronizado en **GitHub y GitLab**. El pipeline usa los templates de la academia y construye la imagen con el **Dockerfile multi-stage standalone** en el runner de Cloud Run — **en verde al primer intento, 73 segundos**. Los jobs de provisión y deploy automatizado están desactivados de forma deliberada porque la infraestructura actual de runners no los soporta — está documentado en la retrospectiva — y la app queda lista para desplegarse como un único contenedor en cualquier plataforma con Mongo gestionado, SMTP y S3. Gracias."

---

## Chuleta de tiempos

| Marca | Escena |
|---|---|
| 0:00 | Presentación |
| 0:15 | Magic link |
| 0:35 | Tablero inversor |
| 1:00 | Screener + compra |
| 1:25 | Bookbuilding + adjudicación |
| 2:00 | Documentos + alertas |
| 2:30 | Definición y stack |
| 2:50 | Arquitectura |
| 3:15 | Estructura y lib/ puro |
| 3:45 | Tests y cobertura |
| 4:15 | Métricas |
| 4:35 | CI + despliegue · cierre |

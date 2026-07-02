# ⚡ QUICKSTART — de cero a corriendo en < 5 min

> Prerrequisitos: Node 20+, Docker, npm.

```bash
# 1. Servicios locales
docker run -d --name bonos-mongo -p 27017:27017 mongo:7
docker run -d --name bonos-mailhog -p 1025:1025 -p 8025:8025 mailhog/mailhog
docker run -d --name bonos-rustfs -p 9001:9000 rustfs/rustfs:latest

# 2. Instalar y configurar
npm install
cp .env.example .env.local    # los valores por defecto funcionan en local

# 3. Sembrar datos de ejemplo (emisores, bonos, carteras + índices)
npm run seed                  # npm run seed:reset para limpiar y re-sembrar

# 4. Arrancar
npm run dev
```

- **App**: http://localhost:3000
- **Emails (magic links y alertas)**: http://localhost:8025

## Usuarios del seed

| Email | Rol |
|---|---|
| `admin@bonos.local` | admin |
| `ana@inversores.local` | inversor (con cartera) |
| `bruno@inversores.local` | inversor (con cartera) |
| `carla@inversores.local` | inversor (con cartera) |

Cualquier email nuevo se registra como inversor al pedir el enlace.

## Cómo entrar (ambos roles)

1. Abre http://localhost:3000 → te lleva a **Acceso**.
2. Escribe el email y pulsa **Enviarme el enlace** (no hay contraseñas).
3. Abre http://localhost:8025 (MailHog), entra en el email recibido y haz clic en el enlace: quedas logueado y redirigido según tu rol (`/admin` o `/investor`). La sesión dura 8 horas; **Salir** en la barra superior la cierra.

---

## 🛠️ Operar como administrador (`admin@bonos.local`)

La página **Emisiones** (`/admin`) es el centro de operaciones: tabla de bonos con su estado y, debajo, los formularios.

### 1. Crear un emisor
En **Nuevo emisor**: nombre, sector y rating inicial → **Crear**. El emisor queda disponible para asignarle emisiones.

### 2. Estructurar una emisión (RF-01)
En **Nueva emisión**:
- **Nombre** del bono (p. ej. "Vulcano 5.0% 2033") y **Emisor**.
- **Nominal (€)** por título y **Títulos** a ofertar.
- **Tipo de cupón**: *Fijo* (el % es la tasa anual) o *Variable* (el % es el **spread** que se suma a la referencia `EURIBOR-SIM` al adjudicar).
- **Frecuencia** de pago (anual/semestral/trimestral) y fechas de **Emisión** y **Vencimiento** (el plazo corto/medio/largo se clasifica solo).

Al crearla, el bono queda **En oferta**: los inversores ya pueden colocar órdenes.

### 3. Seguir el bookbuilding y adjudicar (RF-02/03)
- En la tabla, clic en **Libro de órdenes** del bono en oferta.
- Verás la **demanda agregada por nivel de precio** y el total demandado (avisa si hay sobredemanda).
- Cuando decidas cerrar: introduce el **precio final por título** y pulsa **Adjudicar**. Reglas:
  - Solo participan órdenes con precio ≥ precio final; el resto se rechazan.
  - Si la demanda supera los títulos, **prorrateo proporcional**.
  - Se generan y persisten los **pagos** de cada inversor (cupones + principal). Esto es irreversible.

### 4. Documentos de cumplimiento (RF-04)
En el detalle del bono, sección **Documentos**: elige tipo (fiscal, uso de fondos, covenants, reporte), selecciona el archivo y **Subir**. Quedan en RustFS y cualquier usuario autenticado puede descargarlos.

### 5. Cambiar el rating de un emisor (dispara alertas, RF-07)
En **Ratings de emisores**, cambia el rating en el desplegable. Automáticamente:
- Se generan alertas de **rating** (y de **precio**, si tiene bonos adjudicados) para todos los inversores con posiciones del emisor.
- Si baja a BB/B/CCC, también alerta de **rebalanceo**.
- Cada inversor afectado recibe un **email** (visible en MailHog).

---

## 💼 Operar como inversor (`ana@inversores.local`)

### 1. Mi cartera (`/investor`, RF-06)
Al entrar ves: **valor de mercado** total, **coste de adquisición**, **cobrado** (cupones/principal ya vencidos) y **rendimiento histórico**; debajo, la tabla de posiciones y los **próximos cobros** con fecha e importe.

### 2. Buscar y comprar bonos (Screener, RF-05)
- Menú **Screener**: filtra por **rating**, **sector**, **YTM mínima (%)** y **vence antes de**. El precio estimado y la YTM se calculan según el rating vigente del emisor.
- En un bono **En oferta**, pulsa **Comprar**: indica **títulos** y tu **precio por título** (viene pre-rellenado con el precio estimado; ofrecer más sube tus opciones en la adjudicación).
- La orden queda **pendiente** hasta que el admin adjudique. Si tu precio ≥ precio final, recibirás títulos (quizá prorrateados) y aparecerán en tu cartera con sus pagos programados.

### 3. Alertas (RF-07)
Menú **Alertas**: historial de avisos de rating, precio y rebalanceo sobre tus posiciones. Los mismos avisos llegan por email (MailHog en dev).

---

## Recorrido demo completo (5 min)

1. Entra como `ana@inversores.local` → mira su cartera y próximos cupones.
2. En **Screener**, compra 50 títulos de "Vulcano 5.0% 2033" a 992 €.
3. **Salir** → entra como `admin@bonos.local` → **Libro de órdenes** de Vulcano: verás la demanda de ana y del seed → adjudica a 988 €.
4. Vuelve a entrar como ana: la posición nueva está en su cartera con sus cupones programados.
5. Como admin, baja el rating de **NubeTech Systems** a B → revisa en MailHog los emails de alertas de bruno y carla.

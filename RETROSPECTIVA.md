# 📓 RETROSPECTIVA — bitácora de problemas y soluciones

> Una entrada por incidente, en orden cronológico. Formato: **problema → causa → solución**.

### 2026-07-02 — Docker daemon no disponible al arrancar servicios
- **Problema**: `docker run` fallaba con "failed to connect to the docker API at npipe:...".
- **Causa**: Docker Desktop no estaba arrancado en Windows.
- **Solución**: lanzar `Docker Desktop.exe` y esperar en bucle a que `docker info` responda antes de crear los contenedores.
- **Prevención**: QUICKSTART asume Docker corriendo; si falla el paso 1, arrancar Docker Desktop primero.

### 2026-07-02 — Tests de integración se saltaban en silencio (`it.skipIf`)
- **Problema**: la suite reportaba "4 skipped" con MongoDB levantado.
- **Causa**: doble: (1) `it.skipIf` recibe un **booleano**, no una función — una función es truthy y salta siempre; (2) la conexión se abría en `beforeAll`, pero `skipIf` se evalúa antes, en la fase de colección.
- **Solución**: conectar a MongoDB en la carga del módulo (top-level await con `serverSelectionTimeoutMS` corto) y pasar `it.skipIf(!db)`.
- **Prevención**: si un test de integración "pasa" sospechosamente rápido, comprobar el contador de skipped.

### 2026-07-02 — ESLint 9 + Next 16: `react-hooks/set-state-in-effect`
- **Problema**: `npm run lint` fallaba en las páginas que llamaban `load()` (función con `setState`) directamente dentro de `useEffect`.
- **Causa**: la regla nueva del plugin de react-hooks prohíbe invocar desde el cuerpo del efecto funciones que hacen `setState`, aunque sea tras un `await`.
- **Solución**: patrón "fetch devuelve datos, setState en el callback": `useEffect(() => { fetchAll().then(apply); }, [fetchAll])`, manteniendo `load` para los event handlers (ahí sí está permitido).

### 2026-07-02 — El token del magic link llegaba corrupto al extraerlo de MailHog por API
- **Problema**: al probar el flujo por curl, `/api/auth/verify` devolvía "enlace-invalido".
- **Causa**: MailHog entrega el cuerpo en **quoted-printable**: líneas partidas con `=\n` y `=` codificado como `=3D`, lo que rompía el token JWT extraído con grep. No afecta al uso normal (la UI de MailHog decodifica).
- **Solución**: decodificar el cuerpo con `quopri` (Python) antes de extraer el enlace en los scripts de prueba.

<!-- Añadir aquí cada nuevo incidente: problema → causa → solución -->

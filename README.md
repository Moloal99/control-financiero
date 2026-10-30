# Control Financiero

Sistema personal de control financiero: gastos, ingresos, cuentas, fondos, presupuesto por categoría, análisis de tendencias y proyecciones. Nace de la hoja `RegistroGastosMensual.xlsm` y reproduce toda su lógica (Panel, Distribución, Cuentas, Resumen y Proyección) en una aplicación web instalable que funciona igual en escritorio y celular.

## Qué hace

Una app para ahorrar, no solo para anotar gastos. Separa cuatro cosas:

- **Cuentas**: dónde está tu dinero (BCP, BNB, efectivo). Su saldo debe coincidir con el del banco.
- **Fondos**: para qué es ese dinero dentro de cada cuenta (Gastos, Compras, Ahorro, Emergencias, una meta). Cada fondo arrastra su saldo de un mes a otro.
- **Categorías**: en qué gastas. Ahorrar no es un gasto.
- **Metas**: a dónde quieres llegar, con monto y fecha. Cada meta avanza solo con el saldo de su propio fondo.

| Vista | Contenido |
| --- | --- |
| **Inicio** | Cuánto puedes gastar sin tocar tus ahorros (fondos de gasto menos fijos pendientes), por día; metas; avisos; fijos por registrar; presupuesto del mes; ritmo de gasto y patrimonio. |
| **Registrar** (botón +) | Gasto, ingreso o mover dinero. Un ingreso puede **repartirse entre tus fondos** (con tus % o unos propios solo para ese ingreso) o **no repartirse** e ir a un fondo o quedar sin asignar. Mover sirve para apartar a una meta o transferir entre cuentas. |
| **Págate primero** | Al registrar un ingreso repartido, propone apartar lo que cada meta necesita este mes. |
| **Metas** | Avance, cuánto necesitas por mes para llegar a la fecha, cuánto vas ahorrando y cuándo llegarás. Fondo de emergencia con objetivo automático (N meses de gasto promedio). Aportar y retirar. |
| **Cuentas y fondos** | Saldo de cada cuenta y en qué fondos está repartido, "sin asignar", **ajustar al saldo del banco**, transferencias sugeridas para que cada cuenta tenga el dinero de sus fondos, y movimiento mensual de cada fondo. |
| **Plan** | Presupuesto por categoría y plan del mes (ingreso, gastos, ahorro, libre); **gastos e ingresos fijos** que se recuerdan o registran solos, con detección de gastos que se repiten; **proyección** de patrimonio, ahorro, cuentas y metas a 6–36 meses con **escenarios** guardados (más ingreso, menos gasto, ahorro extra, compras grandes). |
| **Análisis** | Tendencias, **patrimonio** mes a mes y **cierre de mes** exportable a Excel. |
| **Importar y exportar** | Excel con formato o CSV por período; plantilla; carga de Excel/CSV/JSON con vista previa y deshacer; respaldo; volver a los datos de antes de la actualización. |
| **Ajustes** | Categorías, cuentas (saldo al inicio del día indicado), fondos (tipo, % del ingreso, saldo inicial y su fecha, aporte mensual), métodos, ingreso esperado, inflación y tema. |

### Reglas de cálculo

- Saldo de cuenta = saldo inicial + registros desde la fecha del saldo. Lo anterior a esa fecha ya está incluido en el saldo inicial.
- Saldo de fondo = saldo inicial del fondo + reparto de ingresos + lo que se le aparta − lo que se mueve a otros fondos − gastos.
- Cada ingreso repartido guarda los porcentajes con que se repartió: cambiar los % de un fondo solo afecta a los ingresos nuevos.
- Sin asignar = total de cuentas − total de fondos.
- Proyección: ingresos fijos (o el ingreso de Ajustes) repartidos por fondo, gastos fijos, gasto variable promedio (1 a 3 meses) con inflación, movimientos entre fondos que repites cada mes y aportes planificados.

### Actualización de datos

Al abrir la versión nueva, los datos guardados se migran solos: los gastos en la categoría "Ahorro" pasan a ser aportes al fondo de ahorro y la categoría se elimina. Antes se guarda una copia exacta, que puede restaurarse en **Importar y exportar**.

## Escritorio y celular

Es una **PWA** (Progressive Web App): una sola aplicación que se abre en cualquier navegador y se puede **instalar** como app.

- **Escritorio**: abre la URL en Chrome/Edge y usa el botón "Instalar" de la barra de direcciones.
- **Android**: abre la URL en Chrome → menú ⋮ → "Instalar aplicación" / "Agregar a pantalla de inicio".
- **iPhone**: abre la URL en Safari → Compartir → "Agregar a pantalla de inicio".

Funciona sin conexión una vez instalada. Los datos se guardan en el propio dispositivo (localStorage del navegador); para llevarlos de un dispositivo a otro usa **Ajustes → Respaldo (JSON)** y **Restaurar respaldo**.

## Desarrollo

```bash
npm install
npm run dev
```

Abre `http://localhost:5173/control-financiero/`.

```bash
npm run build     # genera dist/
npm run preview   # sirve dist/ localmente
```

## Despliegue en GitHub Pages

El flujo `.github/workflows/deploy.yml` compila y publica en GitHub Pages en cada push a `main`. Solo hay que activar Pages en el repositorio: **Settings → Pages → Source: GitHub Actions**. La app quedará en `https://<usuario>.github.io/<repo>/`.

Si el repositorio se llama distinto a `control-financiero`, el workflow ya pasa el nombre correcto en `VITE_BASE`.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS 4
- Recharts (gráficos)
- Motion (animaciones) y Lucide (iconos)
- ExcelJS (exportar Excel con formato)
- Zustand con persistencia (estado y almacenamiento local)
- SheetJS (leer Excel y CSV al importar)
- vite-plugin-pwa (instalable y sin conexión)

## Modelo de datos

- **Categoría**: nombre, presupuesto mensual, color, icono.
- **Cuenta**: nombre, tipo, saldo inicial y fecha del saldo.
- **Fondo**: nombre, tipo (para gastar o ahorro), % del ingreso, cuenta donde vive, saldo inicial y su fecha, aporte mensual, meta opcional.
- **Gasto**: fecha, categoría, descripción, monto, método de pago, cuenta, fondo, fijo de origen.
- **Movimiento**: ingreso (repartido con sus %, o a un fondo), transferencia (entre cuentas y/o fondos) o ajuste de saldo.
- **Fijo (recurrente)**: gasto o ingreso mensual o anual, día, fondo y cuenta, si se registra solo.
- **Escenario**: variación de ingreso, recorte de gasto, ahorro extra y compras planeadas.

Toda la lógica de cálculo está en `src/lib/calc.ts` (`saldosCuentas`, `resumenFondos`, `puedesGastar`, `progresoMeta`, `ocurrenciasPendientes`, `seriePatrimonio`, `proyectarSaldos`, `cierreMes`, `alertas`). La migración y normalización de datos guardados está en `src/lib/migrar.ts`.

## Ideas para seguir

- Sincronización entre dispositivos (Supabase / Firebase) manteniendo el modo sin conexión.
- Ahorro en dólares con tipo de cambio.
- Empaquetar como app nativa con Capacitor para publicar en Play Store / App Store.

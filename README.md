# Control Financiero

Sistema personal de control financiero: gastos, ingresos, cuentas, fondos, presupuesto por categoría, análisis de tendencias y proyecciones. Nace de la hoja `RegistroGastosMensual.xlsm` y reproduce toda su lógica (Panel, Distribución, Cuentas, Resumen y Proyección) en una aplicación web instalable que funciona igual en escritorio y celular.

## Qué hace

| Vista | Contenido |
| --- | --- |
| **Panel** | Gasto del mes vs. presupuesto, proyección al cierre, ahorro y tasa de ahorro, ritmo de gasto día a día, gasto por categoría, estado por categoría (En control / En riesgo / Excedido), fondos del mes y lectura rápida. |
| **Registrar** (botón +) | Gasto, ingreso o transferencia con vista previa del impacto antes de guardar: disponible de la categoría, saldo de la cuenta, saldo del fondo y saldo neto. Al registrar un ingreso muestra cómo se reparte entre fondos. |
| **Movimientos** | Lista por día con filtros (gastos / ingresos / transferencias, categoría, búsqueda), edición y borrado. |
| **Cuentas y fondos** | Saldo actual de cada cuenta (saldo inicial + ingresos − gastos ± transferencias desde la fecha del saldo), distribución del ingreso por fondos, saldo neto del mes y acumulado, y cuánto debe recibir cada cuenta este mes. |
| **Análisis** | Tendencias de 6/12/24 meses: ingreso vs. gasto con media móvil, gasto apilado por categoría, ranking de categorías, tasa de ahorro mensual y tabla resumen. |
| **Proyección** | 3 a 24 meses, base = promedio de los últimos 3 meses (o presupuesto) × (1 + inflación)ⁿ, con escenarios de variación de ingreso y recorte de gasto. |
| **Ajustes** | Categorías y presupuesto, cuentas, fondos (% del ingreso), métodos de pago, ingreso mensual, inflación, tema. Importar el Excel original, exportar a Excel, respaldo y restauración en JSON. |

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
- Zustand con persistencia (estado y almacenamiento local)
- SheetJS (importar/exportar Excel)
- vite-plugin-pwa (instalable y sin conexión)

## Modelo de datos

- **Categoría**: nombre, presupuesto mensual, color.
- **Cuenta**: nombre, tipo, saldo inicial y fecha del saldo.
- **Fondo**: nombre, % del ingreso, cuenta donde vive, si cuenta para el saldo neto.
- **Gasto**: fecha, categoría, descripción, monto, método de pago, cuenta, fondo.
- **Movimiento**: ingreso (cuenta destino) o transferencia (origen → destino).

Toda la lógica de cálculo está en `src/lib/calc.ts`, con una función por bloque de la hoja original (`resumenMes`, `resumenFondos`, `saldosCuentas`, `distribucionCuentas`, `serieMensual`, `proyeccion`, `impactoGasto`).

## Ideas para seguir

- Sincronización entre dispositivos (Supabase / Firebase) manteniendo el modo sin conexión.
- Gastos recurrentes y recordatorios de pago.
- Metas de ahorro con fecha objetivo.
- Empaquetar como app nativa con Capacitor para publicar en Play Store / App Store.

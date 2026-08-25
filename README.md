# KPI Mandantes

## Objetivo y descripción del proyecto

Aplicación web interna para visualizar indicadores (KPI) de cobranza/judicial por **mandante**. Permite a un usuario autenticado elegir un mandante y navegar por paneles con distintas pestañas de indicadores (estado de cartera, contactabilidad, pagos, reprogramaciones, comparativos, productividad de ejecutivos, embargos, notificaciones, búsquedas negativas, etc.), además de descargar planillas (Excel/CSV) con el detalle de esa información.

Los mandantes actualmente soportados, según el código (`Frontend/src/config/mandantes.js`), son:

- **CLA** — Caja los Andes
- **CENCO** — Cencosud
- **ARAUCANA** — La Araucana
- **UC** — Unidad de Crédito (cartera SQL `ID_PRODUCTO = 890`)

## Arquitectura general

Aplicación de dos capas, verificada directamente en el código:

- **Backend**: API REST construida con **FastAPI** (`Backend/app/main.py`), que expone routers por mandante y un router de autenticación. El acceso a datos se hace con **SQLAlchemy** usando el driver **pyodbc** (`mssql+pyodbc`) contra una base de datos **SQL Server** (`Backend/app/db/database.py`).
- **Frontend**: SPA construida con **React** y **Vite** (`Frontend/package.json`, `Frontend/vite.config.js`), con ruteo mediante `react-router-dom` y gráficos con `recharts`.
- El frontend en desarrollo llama a `/api/...` y Vite reescribe esas rutas hacia el backend (`http://localhost:8000`) quitando el prefijo `/api` (ver `Frontend/vite.config.js`).
- La autenticación es vía **JWT** (biblioteca `pyjwt`), emitido por el backend en `/auth/login` y validado en cada request a los routers de panel mediante `Depends(get_current_user)`.

Esta arquitectura reemplaza paneles legados (CLA/CENCO/ARAUCANA) según el histórico del proyecto, aunque esa referencia no forma parte del código analizado en esta pasada y se documenta aquí solo como contexto funcional.

## Tecnologías utilizadas

### Backend (`Backend/requirements.txt`)
- fastapi
- uvicorn[standard]
- sqlalchemy
- pyodbc
- python-dotenv
- pyjwt
- werkzeug (usado para verificación de hash de contraseña, `check_password_hash`)
- openpyxl (generación de planillas Excel para descargas de los paneles CLA y UC)

Entorno de desarrollo detectado: Python 3.13 (según `Backend/.venv/pyvenv.cfg`). No hay un archivo que fije una versión mínima de Python de forma explícita (pendiente de confirmar si se requiere una versión específica en otros entornos).

### Frontend (`Frontend/package.json`)
- react ^19.2.8
- react-dom ^19.2.8
- react-router-dom ^7.18.2
- recharts ^3.10.1
- @mui/material ^9.3.1 y @mui/icons-material ^9.3.1 (componentes de UI e íconos, usados de forma transversal en paneles, botones y modales)
- @emotion/react ^11.14.0 y @emotion/styled ^11.14.1 (dependencias de estilo requeridas por MUI)
- vite ^8.2.0 (dev)
- @vitejs/plugin-react ^6.0.4 (dev)
- oxlint ^1.75.0 (dev, linter)

No se especifica una versión mínima de Node.js en `package.json` (sin campo `engines`); pendiente de confirmar la versión exacta soportada, se recomienda usar una versión reciente de Node compatible con Vite 8.

## Estructura de carpetas

```
Proyecto_Final/
├── .env                        # variables de entorno (no versionado, ver .gitignore)
├── .gitignore
├── Backend/
│   ├── requirements.txt
│   ├── .venv/                  # entorno virtual Python (local)
│   └── app/
│       ├── main.py             # instancia FastAPI, CORS, montaje de routers, /health
│       ├── core/
│       │   ├── config.py       # carga de .env y variables de configuración
│       │   └── security.py     # hash/verificación de password y JWT
│       ├── db/
│       │   └── database.py     # engine SQLAlchemy (mssql+pyodbc)
│       ├── routers/
│       │   ├── auth.py         # login, me
│       │   ├── panel_cla.py    # endpoints panel Caja los Andes
│       │   ├── panel_cenco.py  # endpoints panel Cencosud
│       │   ├── panel_araucana.py # endpoints panel La Araucana
│       │   ├── panel_uc.py     # endpoints panel Unidad de Crédito
│       │   └── admin.py        # recálculo manual de paneles (solo rol ADMIN)
│       └── schemas/
│           ├── auth.py
│           ├── panel_cla.py
│           ├── panel_cenco.py
│           ├── panel_araucana.py
│           ├── panel_uc.py
│           └── admin.py
└── Frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx              # definición de rutas (react-router-dom)
        ├── api/
        │   ├── client.js        # fetch autenticado (Bearer token), maneja /api
        │   └── download.js      # descarga de archivos (Excel/CSV) con Bearer token
        ├── context/
        │   ├── AuthContext.jsx  # login/logout, usuario actual, token en localStorage
        │   └── ThemeContext.jsx
        ├── hooks/
        │   └── useAdminPanelRefresh.js  # ciclo de vida del job de "Actualizar paneles" (solo rol ADMIN)
        ├── config/
        │   ├── mandantes.js         # lista de mandantes (cla, cenco, araucana, uc)
        │   ├── cencoCarteras.js     # carteras disponibles para Cencosud (427, 875)
        │   └── araucanaCarteras.js  # carteras disponibles para La Araucana
        ├── pages/
        │   ├── Login.jsx
        │   ├── MandanteSelector.jsx  # incluye el botón "Actualizar paneles" (visible solo si role === 'ADMIN')
        │   └── panels/
        │       ├── PanelCLA.jsx
        │       ├── PanelCenco.jsx
        │       ├── PanelAraucana.jsx
        │       ├── PanelUC.jsx  # dashboard de una sola página (no usa tabs, a diferencia de los otros paneles)
        │       ├── cla/      (tabs: estado cartera, contactabilidad, pagos, repros, comparativo, ejecutivos, productividad)
        │       ├── cenco/    (tabs: estado cartera, contactabilidad, pagos, repros, comparativo, ejecutivos)
        │       ├── araucana/ (tabs: estado cartera, notificación, búsquedas negativas, embargo)
        │       └── uc/       (bloques del dashboard: KpiGridUC, PagosCard, EmbudoBloque, EstadoCarteraDonut, EvolucionBloque,
        │                       ActividadDiariaBloque, FranjaHorariaBloque, DimensionesBloque, DetalleTabla, bucketMeta.js)
        └── components/
            ├── panel/ (KpiCard.jsx, PanelTabs.jsx)
            ├── admin/ (PanelRefreshModal.jsx — modal de recálculo de paneles, solo rol ADMIN)
            └── charts/ (BarChartHorizontal, BarChartVertical, DonutChart, LineChartFilled, StackedBarChartVertical, colors.js)
```

## Requisitos previos

- Python 3.13 (versión verificada en el entorno virtual existente; otras versiones 3.x podrían funcionar pero no están confirmadas).
- Node.js reciente (versión mínima exacta pendiente de confirmar) y npm.
- Acceso a una instancia de **SQL Server** con la base de datos configurada (nombre exacto no incluido aquí por seguridad; se define vía variables de entorno).
- Driver ODBC de SQL Server instalado en el sistema. Según `Backend/app/db/database.py`, el driver se resuelve según el sistema operativo donde corre el backend: en Windows usa `ODBC Driver 17 for SQL Server` (hardcodeado); en cualquier otro sistema (ej. Linux) usa `FreeTDS` con `SERVERNAME=judicial_sql` (también hardcodeado, pendiente de confirmar si ese nombre de servidor DSN corresponde a una entrada fija esperada en `/etc/freetds/freetds.conf` del entorno de despliegue). En ambos casos, esto puede sobreescribirse por completo definiendo la variable de entorno `DB_CONN_STR` con una cadena de conexión ODBC ya armada.
- Acceso de red al servidor SQL Server correspondiente, incluyendo (para los reportes de La Araucana) al servidor vinculado `PROMETEO\FASTCO` / base `SISTEMA_JFASTCO`, referenciado directamente en las consultas de `Backend/app/routers/panel_araucana.py`.

## Instalación de dependencias

### Backend

```bash
cd Backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

### Frontend

```bash
cd Frontend
npm install
```

## Configuración necesaria

El backend carga variables de entorno desde un archivo `.env` ubicado en la **raíz del proyecto** (`Backend/app/core/config.py` calcula la raíz subiendo 3 niveles desde el propio archivo y hace `load_dotenv(ROOT_DIR / ".env")`). Ese `.env` ya existe en este proyecto pero no fue leído ni copiado en esta documentación por política de seguridad; a continuación se listan únicamente los **nombres** de variables que el código efectivamente consume.

## Variables de entorno

Obtenidas exclusivamente de `Backend/app/core/config.py` (no se muestran ni infieren valores):

| Variable | Obligatoria | Valor por defecto si no se define |
|---|---|---|
| `DB_SERVER` | Sí | — (falla si no está definida) |
| `DB_DATABASE` | Sí | — (falla si no está definida) |
| `DB_USER` | Sí | — (falla si no está definida) |
| `DB_PASSWORD` | Sí | — (falla si no está definida) |
| `JWT_SECRET_KEY` | Sí | — (falla si no está definida) |
| `JWT_ALGORITHM` | No | `HS256` |
| `JWT_EXPIRE_MINUTES` | No | `480` |

Las variables marcadas como obligatorias están leídas con `os.environ[...]`, por lo que el backend no arrancará si faltan. No se encontró un archivo `.env.example` en el repositorio (pendiente de confirmar si se desea agregar uno como plantilla, sin valores reales).

Además, `Backend/app/db/database.py` lee directamente (sin pasar por `config.py`) una variable opcional adicional:

| Variable | Obligatoria | Comportamiento si no está definida |
|---|---|---|
| `DB_CONN_STR` | No | Se arma la cadena de conexión ODBC internamente según el sistema operativo (ver sección "Requisitos previos") |

Nota: la variable `DB_ODBC_DRIVER` que documentaba una versión anterior de este README **ya no existe en el código** (el driver ODBC quedó hardcodeado según sistema operativo, ver más abajo); si algún `.env` existente todavía la define, no tiene efecto.

`CORS_ORIGINS` está definido como lista fija en el propio código (no como variable de entorno), con los orígenes: `http://localhost:5173`, `http://192.168.60.148:5173`, `http://172.25.30.67:5173`.

## Cómo levantar el frontend

```bash
cd Frontend
npm run dev
```

Otros scripts disponibles en `Frontend/package.json`: `npm run build`, `npm run preview`, `npm run lint` (oxlint).

## Cómo levantar el backend

Desde la carpeta `Backend` (con el entorno virtual activado):

```bash
uvicorn app.main:app --reload
```

También es posible ejecutarlo desde la raíz del proyecto indicando la ruta completa del módulo, por ejemplo `uvicorn Backend.app.main:app --reload`, siempre que el intérprete tenga acceso al paquete `app` (pendiente de confirmar cuál es el comando exacto usado en despliegue, ya que no existe un script o archivo de arranque documentado en el repositorio).

## Puertos utilizados

- **Frontend (Vite dev server)**: `5173` — confirmado porque `Frontend/vite.config.js` reescribe `/api` y los orígenes CORS del backend (`Backend/app/core/config.py`) incluyen explícitamente `http://localhost:5173`.
- **Backend (FastAPI/uvicorn)**: `8000` — inferido porque `Frontend/vite.config.js` define el proxy `target: 'http://localhost:8000'`; no se encontró un `--port` explícito en el código del backend, por lo que corresponde al puerto por defecto de `uvicorn`. Pendiente de confirmar si en algún entorno se sobreescribe este puerto.

## Funcionalidades y vistas disponibles

- **Login** (`Login.jsx`): formulario de usuario/contraseña contra `/auth/login`.
- **Selector de mandante** (`MandanteSelector.jsx`): pantalla posterior al login para elegir entre CLA, CENCO, ARAUCANA o UC, y cerrar sesión. Si el usuario autenticado tiene `role === 'ADMIN'`, se muestra además un botón **"Actualizar paneles"** que abre un modal (`PanelRefreshModal.jsx`, con estado manejado por el hook `useAdminPanelRefresh.js`) para elegir un período y disparar el recálculo real de los 4 mandantes contra `POST /admin/panel-refresh`, con barra de progreso por paso (uno por mandante/cartera) mediante polling a `GET /admin/panel-refresh/{job_id}`.
- **Panel CLA** (`PanelCLA.jsx`): selector de período; tabs de Estado Cartera, Contactabilidad, Pagos, Reprogramaciones, Comparativo, Ejecutivos y Productividad; descarga de sábanas Excel de Pagos y Reprogramaciones.
- **Panel CENCO** (`PanelCenco.jsx`): selector de cartera (H1 / T4) y período; tabs de Estado Cartera, Contactabilidad, Pagos, Reprogramaciones, Comparativo y Ejecutivos.
- **Panel ARAUCANA** (`PanelAraucana.jsx`): selector de cartera (Juicio Ordinario, Caja La Araucana, Lipigas, Forum, Santander, Caja Los Andes, Cencosud); tabs de Estado Cartera, Notificación, Búsquedas Negativas y Embargo; descarga de CSV general y de embargo.
- **Panel UC** (`PanelUC.jsx`, cartera fija `890` — Unidad de Crédito): a diferencia de CLA/CENCO/ARAUCANA, es un **dashboard de una sola página** (sin tabs), con selector de período y: fila de 10 KPIs (`KpiGridUC.jsx`) más una card adicional de **Pagos** (`PagosCard.jsx`, monto recaudado y cuotas pagadas del período) que al hacer clic abre un modal con el desglose diario, embudo de gestión (`EmbudoBloque.jsx`), dona de estado de cartera (`EstadoCarteraDonut.jsx`), evolución temporal con selector de métrica (`EvolucionBloque.jsx`), actividad diaria y franja horaria de gestiones (`ActividadDiariaBloque.jsx`, `FranjaHorariaBloque.jsx`), 6 paneles de análisis por dimensión (ejecutivo, tipificación, estado de convenio, prioridad, intensidad de gestión y estado/bucket — `DimensionesBloque.jsx`) y una tabla de detalle paginada con filtro por clic en los gráficos y exportación a Excel (`DetalleTabla.jsx`). Es la primera iteración del panel; el "Constructor de reportes" y la "Bitácora de exploración" de la propuesta original quedan pendientes para una segunda iteración.
- Selector de tema claro/oscuro (`ThemeToggle.jsx` / `ThemeContext.jsx`), visible en toda la aplicación.

### Limitaciones conocidas del Panel UC

- Tramo de mora (`TRAMO_MORA`), región y días de mora existen como columnas en el esquema de datos pero hoy llegan `NULL` al 100% para esta cartera; no se muestran como paneles de dimensión. Además, `PANEL_UC_CUENTA` tiene una columna adicional `TRAMO` (distinta de `TRAMO_MORA`) agregada para uso futuro, sin fuente de datos definida todavía: siempre queda `NULL` (ver `Backend/scripts_sql/panel_uc_monto_asignado_tramo.sql`).
- La "Prioridad de gestión" se muestra como código numérico crudo, sin tabla de homologación a una glosa legible todavía.
- La regla que distingue "compromiso de pago" vigente de "compromiso roto" (bucket `COMP_ROTO` en `PANEL_UC_CUENTA`) es una hipótesis del equipo de datos, no confirmada por el cliente (ver comentario en el stored procedure de proceso).
- El endpoint `GET /panel/uc/descarga` sigue exportando la columna `MONTO_DOCUMENTO` (no `MONTO_ASIGNADO`) como "deuda", a diferencia de `GET /panel/uc/detalle`, que ya expone `monto_asignado`; es una inconsistencia detectada en el código (`Backend/app/routers/panel_uc.py`, función `descarga`) pendiente de corrección.
- El proceso de recálculo (`SP_Panel_UC_Proceso`) puede dispararse bajo demanda desde la interfaz mediante el botón "Actualizar paneles" (solo visible para usuarios con rol `ADMIN`, ver sección "Autenticación y roles"), sin necesidad de ejecutar SQL manualmente. Sin embargo, no existe todavía un job de SQL Agent (ni ningún otro mecanismo automático) que dispare ese recálculo de forma periódica: el proceso, manual o vía el botón de administración, siempre requiere que alguien lo inicie explícitamente.

## Rutas principales del frontend

Definidas en `Frontend/src/App.jsx` (todas menos `/login` están protegidas y redirigen a `/login` si no hay sesión):

| Ruta | Componente | Acceso |
|---|---|---|
| `/login` | `Login` | Público |
| `/` | `MandanteSelector` | Protegida |
| `/panel/cla` | `PanelCLA` | Protegida |
| `/panel/cenco` | `PanelCenco` | Protegida |
| `/panel/araucana` | `PanelAraucana` | Protegida |
| `/panel/uc` | `PanelUC` | Protegida |

## Endpoints relevantes del backend

Todos los endpoints bajo `/panel/*` requieren un JWT válido (`Authorization: Bearer <token>`), impuesto vía `Depends(get_current_user)` a nivel de router.

### Salud
- `GET /health` — healthcheck simple, sin autenticación (`Backend/app/main.py`).

### Autenticación (`Backend/app/routers/auth.py`, prefijo `/auth`)
- `POST /auth/login` — valida usuario/contraseña contra `dbo.TBL_USERS`/`dbo.TBL_ROLES`, actualiza `last_login_at` y devuelve un JWT.
- `GET /auth/me` — devuelve los datos del usuario autenticado a partir del JWT.

### Panel CLA (`Backend/app/routers/panel_cla.py`, prefijo `/panel/cla`)
- `GET /panel/cla/estado-cartera` — estado de cartera por clasificación, filtrado por `periodo`.
- `GET /panel/cla/contactabilidad` — matriz de contactabilidad, resumen de contacto e inbound, filtrado por `periodo`.
- `GET /panel/cla/pagos` — resumen de pagos y serie diaria, filtrado por `periodo`.
- `GET /panel/cla/repros` — resumen de reprogramaciones y serie diaria, filtrado por `periodo`.
- `GET /panel/cla/ejecutivos` — productividad por ejecutivo, filtrado por `periodo`.
- `GET /panel/cla/comparativo` — comparativo de pagos y repros vs. período anterior (ejecuta stored procedure `SP_Panel1_Comparativo`).
- `GET /panel/cla/productividad` — productividad general y avance por etapa (ejecuta `SP_Panel1_Productividad` y `SP_Panel1_AvanceEtapa`).
- `GET /panel/cla/descargar-pagos` — descarga Excel de la sábana de pagos, filtrado por `periodo`.
- `GET /panel/cla/descargar-repros` — descarga Excel de la sábana de reprogramaciones, filtrado por `periodo`.

### Panel CENCO (`Backend/app/routers/panel_cenco.py`, prefijo `/panel/cenco`)
- `GET /panel/cenco/estado-cartera` — estado de cartera, filtrado por `periodo` y `cartera` (default `427`).
- `GET /panel/cenco/contactabilidad` — matriz y resumen de contactabilidad, filtrado por `periodo` y `cartera`.
- `GET /panel/cenco/pagos` — resumen de pagos y serie diaria, filtrado por `periodo` y `cartera`.
- `GET /panel/cenco/repros` — resumen de reprogramaciones y serie diaria, filtrado por `periodo` y `cartera`.
- `GET /panel/cenco/ejecutivos` — productividad por ejecutivo, filtrado por `periodo` y `cartera`.
- `GET /panel/cenco/comparativo` — comparativo de pagos y repros, filtrado por `periodo` y `cartera`.

### Panel ARAUCANA (`Backend/app/routers/panel_araucana.py`, prefijo `/panel/araucana`)
- `GET /panel/araucana/estado-cartera` — estado de cartera por clasificación, filtrado por `cartera` (default `16`), usando el período más reciente disponible para esa cartera.
- `GET /panel/araucana/embargo` — distribución por etapa de embargo, filtrado por `cartera`.
- `GET /panel/araucana/notificacion` — notificaciones por tipo/clasificación/antigüedad, filtrado por `cartera`.
- `GET /panel/araucana/busquedas-negativas` — búsquedas negativas por tipo, filtrado por `cartera`.
- `GET /panel/araucana/descarga` — descarga CSV de la sábana general, filtrado por `cartera` (consulta contra un servidor vinculado externo, ver sección de conexión a SQL Server).
- `GET /panel/araucana/descarga-embargo` — descarga CSV de la sábana filtrada a etapas de embargo, filtrado por `cartera`.

### Panel UC (`Backend/app/routers/panel_uc.py`, prefijo `/panel/uc`)

El parámetro `cartera` es opcional en todos los endpoints con valor por defecto `890`. El parámetro `periodo` (formato `YYYYMM`) se valida con una dependencia que responde `400` si el formato es inválido, antes de tocar la base de datos.

- `GET /panel/uc/periodos` — lista de períodos con datos procesados y cantidad de cuentas por período, filtrado por `cartera`.
- `GET /panel/uc/resumen` — los 10 KPI principales del período (cuentas, deuda, cobertura, contactabilidad, compromisos, incumplimiento, intensidad, etc.) comparados contra el período anterior, filtrado por `periodo` y `cartera`.
- `GET /panel/uc/estado-cartera` — distribución de cuentas/deuda/gestiones por `BUCKET` (estado de gestión), filtrado por `periodo` y `cartera`.
- `GET /panel/uc/pagos-resumen` — total de monto recaudado y cuotas pagadas del período, filtrado por `periodo` y `cartera` (lee de `dbo.PANEL_UC_PAGO_DIA`).
- `GET /panel/uc/pagos-detalle` — desglose diario (fecha, casos, monto) de los pagos del período, filtrado por `periodo` y `cartera` (misma tabla `dbo.PANEL_UC_PAGO_DIA`).
- `GET /panel/uc/embudo` — embudo de gestión (asignadas → gestionadas → contactadas → contacto directo → con compromiso → compromiso cumplido), filtrado por `periodo` y `cartera`.
- `GET /panel/uc/evolucion` — serie histórica por período (todos los períodos disponibles) de cuentas, deuda, gestiones, contactabilidad y compromisos, filtrado por `cartera`.
- `GET /panel/uc/actividad-diaria` — cantidad de cuentas por día de última gestión y bucket, filtrado por `periodo` y `cartera`.
- `GET /panel/uc/franja-horaria` — cantidad de gestiones y contactos por hora del día, filtrado por `periodo` y `cartera`.
- `GET /panel/uc/dimensiones` — agrupación de cuentas/deuda/contactos/compromisos por ejecutivo, tipificación, estado de convenio, prioridad (código crudo), intensidad de gestión y bucket, filtrado por `periodo` y `cartera`.
- `GET /panel/uc/detalle` — listado paginado de cuentas con filtros por `bucket`, `ejecutivo`, `tipificacion`, `estado_convenio` y `fecha`, y orden configurable; filtrado por `periodo` y `cartera`. El campo de deuda de cada cuenta se llama `monto_asignado` en la respuesta (proviene de la columna `MONTO_ASIGNADO`, poblada desde `DATO_28` del origen; reemplazó a `MONTO_DOCUMENTO` como fuente de "deuda asignada" en todos los cálculos del panel UC).
- `GET /panel/uc/descarga` — descarga Excel del detalle de cuentas con los mismos filtros que `/detalle` (sin paginar), filtrado por `periodo` y `cartera`. Nota: a diferencia de `/detalle`, esta descarga todavía exporta la columna `MONTO_DOCUMENTO` en vez de `MONTO_ASIGNADO` (ver "Limitaciones conocidas del Panel UC").

No se documentan aquí las consultas SQL completas; solo su propósito, siguiendo la política de este proyecto.

### Administración (`Backend/app/routers/admin.py`, prefijo `/admin`)

Estos 3 endpoints requieren, además de un JWT válido, que el usuario autenticado tenga `role == "ADMIN"` (`require_admin`, devuelve `403` si no cumple). Son el único lugar del backend con esta restricción; el resto de los endpoints de panel no diferencian por rol (ver "Autenticación y roles").

- `POST /admin/panel-refresh` — recibe `{ "periodo": "YYYYMM" }` y dispara en segundo plano (`threading.Thread`) el recálculo real de los 4 mandantes (CLA, CENCO, ARAUCANA con sus 7 carteras/productos, y UC), ejecutando para cada uno el stored procedure de proceso correspondiente (`SP_Panel1_Proceso_Caja_Los_Andes`, `SP_Panel_Proceso_Cenco`, `SP_Panel_Proceso_ARAUCANA`, `SP_Panel_UC_Proceso`). Devuelve `202` con un `job_id`; responde `409` si ya hay una actualización en curso.
- `GET /admin/panel-refresh/last` — devuelve el estado del último job registrado (el más reciente por fecha de inicio).
- `GET /admin/panel-refresh/{job_id}` — devuelve el estado y progreso paso a paso (por mandante/cartera) de un job específico.

El estado de los jobs se guarda en un diccionario en memoria del proceso (`app/routers/admin.py`), protegido por un `threading.Lock`. Esto implica que el historial de jobs **no sobrevive un reinicio del backend** y **no funcionaría correctamente si el backend se despliega con más de un worker** (ej. `gunicorn -w N`), ya que cada worker tendría su propio store aislado.

## Conexión con SQL Server

- El backend se conecta a SQL Server mediante SQLAlchemy con el dialecto `mssql+pyodbc` (`Backend/app/db/database.py`), armando la cadena de conexión ODBC según el sistema operativo (Windows: `ODBC Driver 17 for SQL Server`; otro SO: `FreeTDS`), con `TrustServerCertificate=yes`, salvo que se defina `DB_CONN_STR` para sobreescribir la cadena completa (ver secciones "Requisitos previos" y "Variables de entorno").
- El motor (`engine`) se crea con `pool_pre_ping=True`, `isolation_level="AUTOCOMMIT"` y parámetros explícitos de pool (`pool_size=10`, `max_overflow=20`, `pool_timeout=30`, `pool_recycle=1800`). Este ajuste corrigió un problema real de conexiones que quedaban con transacciones abiertas sin cerrarse.
- Servidor, base de datos, usuario y contraseña se obtienen desde variables de entorno (ver sección "Variables de entorno"); no hay credenciales hardcodeadas en el código analizado.
- Las consultas usan principalmente tablas con prefijo `PANEL1_*` (CLA), `PANEL_CENCO_*` (Cencosud), `PANEL_ARAUCANA_*` (La Araucana) y `PANEL_UC_*` (Unidad de Crédito), además de `dbo.TBL_USERS` y `dbo.TBL_ROLES` para autenticación.
- Algunos endpoints de CLA ejecutan stored procedures (`SP_Panel1_Comparativo`, `SP_Panel1_Productividad`, `SP_Panel1_AvanceEtapa`, `SP_Panel1_Sabanas_Caja_Los_Andes`).
- Los endpoints de descarga de La Araucana consultan además un servidor vinculado (linked server) identificado en el código como `[PROMETEO\FASTCO].SISTEMA_JFASTCO`, con tablas como `tbl_resultados_sabana`, `TBL_CLASIFICACION_ESTADOS` y `TBL_JUICIO`. Esto implica que, además de la base principal, el entorno donde corra el backend debe tener conectividad y permisos hacia ese servidor vinculado.
- **Panel UC — patrón de proceso batch**: el backend de UC nunca consulta en vivo la tabla de origen `BASE_CARGAS.dbo.TBL_CARGA_INICIAL` (~863 millones de filas, sin índices). En su lugar lee de tres tablas físicas materializadas, `dbo.PANEL_UC_CUENTA` (grano cuenta/documento), `dbo.PANEL_UC_GESTION` (grano evento de gestión) y `dbo.PANEL_UC_PAGO_DIA` (grano día de pago, persistencia histórica del desglose diario de pagos, ya que la tabla de origen `TBL_PAGOS_UNICRE` no acumula histórico — solo conserva el período vigente), que son pobladas por el stored procedure `dbo.SP_Panel_UC_Proceso @CARTERA, @Periodo`. Ese SP toma datos de `BASE_CARGAS.dbo.TBL_CARGA_INICIAL`/`TBL_CARGAS_POR_PRODUCTO`, `BASE_GESTIONES.dbo.TBL_B2C_GESTIONES_MG`/`TBL_B2C_GESTIONES` y `TBL_PAGOS_UNICRE`, siguiendo el mismo patrón ETL ya usado por CLA y CENCO. Es transaccional (DELETE + INSERT con `ROLLBACK` ante error) y puede dispararse manualmente por SQL o bajo demanda desde el botón admin "Actualizar paneles" (`POST /admin/panel-refresh`); no existe todavía un job de SQL Agent que lo ejecute de forma periódica y automática. El script que crea las tablas y el SP original vive en `Backend/scripts_sql/panel_uc_setup.sql`; dos scripts posteriores extienden ese mismo SP: `panel_uc_monto_asignado_tramo.sql` (agrega las columnas `MONTO_ASIGNADO` y `TRAMO` a `PANEL_UC_CUENTA`) y `panel_uc_pago_dia.sql` (crea `PANEL_UC_PAGO_DIA` y el bloque del SP que la puebla). Los tres viven en una carpeta excluida del repositorio por `.gitignore`, ya ejecutados contra la base de datos real.

## Autenticación y roles

- Autenticación basada en **JWT** (`Backend/app/core/security.py`), firmado con `JWT_SECRET_KEY` y algoritmo `JWT_ALGORITHM` (por defecto `HS256`), con expiración configurable vía `JWT_EXPIRE_MINUTES` (por defecto 480 minutos).
- Las contraseñas se verifican con `werkzeug.security.check_password_hash` contra un hash almacenado en `dbo.TBL_USERS.password_hash`; el backend nunca maneja contraseñas en texto plano más allá de la verificación puntual.
- El rol del usuario (`role`, código proveniente de `dbo.TBL_ROLES`) se incluye en el payload del JWT y se devuelve en `/auth/login` y `/auth/me`. Existe una única restricción de acceso por rol en todo el código revisado: la dependencia `require_admin` de `Backend/app/routers/admin.py`, que exige `role == "ADMIN"` (responde `403` si no se cumple) para los 3 endpoints bajo `/admin/*` (recálculo manual de paneles). Fuera de eso, **el resto de los endpoints de panel (`/panel/*`) no restringen el acceso según el rol**, solo exigen estar autenticado.
- En el frontend, el token se guarda en `localStorage` (`Frontend/src/api/client.js`) y se envía como `Authorization: Bearer <token>` en cada request; las rutas protegidas (`ProtectedRoute` en `App.jsx`) solo verifican que exista un usuario autenticado, sin diferenciar por rol. La única diferenciación visual por rol en el frontend es el botón "Actualizar paneles" en `MandanteSelector.jsx`, que solo se renderiza si `user.role === 'ADMIN'` (una ocultación de UI, no un control de seguridad por sí sola: la protección real ocurre en el backend vía `require_admin`).

## Dependencias importantes

Ver secciones "Tecnologías utilizadas" para el detalle completo. Las de mayor impacto arquitectónico son:
- `fastapi` + `uvicorn`: framework y servidor ASGI del backend.
- `sqlalchemy` + `pyodbc`: acceso a SQL Server.
- `pyjwt` + `werkzeug`: autenticación (JWT y verificación de hash de password).
- `openpyxl`: generación de archivos Excel para descargas.
- `react`, `react-router-dom`, `recharts`, `vite`: base del frontend y sus gráficos.
- `@mui/material` + `@mui/icons-material` (con `@emotion/react`/`@emotion/styled` como dependencias de estilo): íconos y componentes de UI usados de forma transversal en paneles, botones y modales, incluyendo el modal de administración de recálculo de paneles.

## Troubleshooting básico

- **El backend no arranca / error de variable de entorno faltante**: revisar que el archivo `.env` en la raíz del proyecto contenga `DB_SERVER`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD` y `JWT_SECRET_KEY`, ya que se leen con `os.environ[...]` y no tienen valor por defecto.
- **Error de conexión a SQL Server / driver ODBC no encontrado**: verificar que el driver que corresponde según el sistema operativo (`ODBC Driver 17 for SQL Server` en Windows, `FreeTDS` en otros sistemas) esté instalado en el sistema donde corre el backend, o definir `DB_CONN_STR` con una cadena de conexión ODBC propia si se necesita otro driver.
- **El frontend no puede llamar a la API (errores 404/CORS)**: en desarrollo, el frontend depende de que el backend esté corriendo en `http://localhost:8000` (target del proxy en `vite.config.js`); si el backend corre en otro host/puerto, hay que ajustar ese proxy o las reglas de `CORS_ORIGINS` en `Backend/app/core/config.py`.
- **401 al llamar a endpoints de panel**: los endpoints `/panel/*` requieren un JWT válido; verificar que el token no haya expirado (`JWT_EXPIRE_MINUTES`) y que se esté enviando el header `Authorization: Bearer <token>`.
- **Descargas de La Araucana (`/panel/araucana/descarga*`) fallan o devuelven 404**: estos endpoints dependen de conectividad al servidor vinculado `PROMETEO\FASTCO` / base `SISTEMA_JFASTCO`; validar que ese servidor esté accesible desde donde corre el backend.
- **Sin datos en un panel**: varios endpoints devuelven 404 con detalle "Sin datos" cuando la consulta no encuentra filas para el `periodo`/`cartera` seleccionado; probar con otro período o cartera.
- **400 al llamar a endpoints de `/panel/uc/*`**: el parámetro `periodo` debe tener formato `YYYYMM` (6 dígitos); un valor con otro formato responde `400 Periodo inválido` antes de consultar la base de datos.
- **Panel UC sin períodos disponibles**: si `/panel/uc/periodos` devuelve una lista vacía, significa que no se ha ejecutado `EXEC dbo.SP_Panel_UC_Proceso @CARTERA=890, @Periodo='YYYYMM'` para ningún período; el proceso puede dispararse manualmente por SQL o mediante el botón "Actualizar paneles" (solo admin), pero no hay job programado que lo ejecute solo.
- **403 al llamar a `/admin/*`**: estos endpoints exigen `role == "ADMIN"` en el JWT del usuario (`require_admin` en `Backend/app/routers/admin.py`); un usuario autenticado con otro rol recibe `403`.
- **409 al iniciar una actualización de paneles (`POST /admin/panel-refresh`)**: ya hay un job de recálculo en curso; el backend solo permite un job a la vez. Hay que esperar a que termine (o consultar `GET /admin/panel-refresh/last`) antes de iniciar uno nuevo.

---

Este documento fue generado a partir de una revisión directa del código fuente del proyecto (backend y frontend). Cualquier sección marcada como "pendiente de confirmar" debe validarse con el equipo antes de asumirse como definitiva.

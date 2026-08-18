# KPI Mandantes

## Objetivo y descripción del proyecto

Aplicación web interna para visualizar indicadores (KPI) de cobranza/judicial por **mandante**. Permite a un usuario autenticado elegir un mandante y navegar por paneles con distintas pestañas de indicadores (estado de cartera, contactabilidad, pagos, reprogramaciones, comparativos, productividad de ejecutivos, embargos, notificaciones, búsquedas negativas, etc.), además de descargar planillas (Excel/CSV) con el detalle de esa información.

Los mandantes actualmente soportados, según el código (`Frontend/src/config/mandantes.js`), son:

- **CLA** — Caja los Andes
- **CENCO** — Cencosud
- **ARAUCANA** — La Araucana

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
- openpyxl (generación de planillas Excel para descargas del panel CLA)

Entorno de desarrollo detectado: Python 3.13 (según `Backend/.venv/pyvenv.cfg`). No hay un archivo que fije una versión mínima de Python de forma explícita (pendiente de confirmar si se requiere una versión específica en otros entornos).

### Frontend (`Frontend/package.json`)
- react ^19.2.8
- react-dom ^19.2.8
- react-router-dom ^7.18.2
- recharts ^3.10.1
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
│       │   └── panel_araucana.py # endpoints panel La Araucana
│       └── schemas/
│           ├── auth.py
│           ├── panel_cla.py
│           ├── panel_cenco.py
│           └── panel_araucana.py
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
        ├── config/
        │   ├── mandantes.js         # lista de mandantes (cla, cenco, araucana)
        │   ├── cencoCarteras.js     # carteras disponibles para Cencosud (427, 875)
        │   └── araucanaCarteras.js  # carteras disponibles para La Araucana
        ├── pages/
        │   ├── Login.jsx
        │   ├── MandanteSelector.jsx
        │   └── panels/
        │       ├── PanelCLA.jsx
        │       ├── PanelCenco.jsx
        │       ├── PanelAraucana.jsx
        │       ├── cla/      (tabs: estado cartera, contactabilidad, pagos, repros, comparativo, ejecutivos, productividad)
        │       ├── cenco/    (tabs: estado cartera, contactabilidad, pagos, repros, comparativo, ejecutivos)
        │       └── araucana/ (tabs: estado cartera, notificación, búsquedas negativas, embargo)
        └── components/
            ├── panel/ (KpiCard.jsx, PanelTabs.jsx)
            └── charts/ (BarChartHorizontal, BarChartVertical, DonutChart, LineChartFilled, colors.js)
```

## Requisitos previos

- Python 3.13 (versión verificada en el entorno virtual existente; otras versiones 3.x podrían funcionar pero no están confirmadas).
- Node.js reciente (versión mínima exacta pendiente de confirmar) y npm.
- Acceso a una instancia de **SQL Server** con la base de datos configurada (nombre exacto no incluido aquí por seguridad; se define vía variables de entorno).
- Driver ODBC de SQL Server instalado en el sistema (por defecto el backend usa `ODBC Driver 17 for SQL Server`, configurable vía variable de entorno; ver `Backend/app/core/config.py`).
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
| `DB_ODBC_DRIVER` | No | `ODBC Driver 17 for SQL Server` |
| `JWT_SECRET_KEY` | Sí | — (falla si no está definida) |
| `JWT_ALGORITHM` | No | `HS256` |
| `JWT_EXPIRE_MINUTES` | No | `480` |

Las variables marcadas como obligatorias están leídas con `os.environ[...]`, por lo que el backend no arrancará si faltan. No se encontró un archivo `.env.example` en el repositorio (pendiente de confirmar si se desea agregar uno como plantilla, sin valores reales).

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
- **Selector de mandante** (`MandanteSelector.jsx`): pantalla posterior al login para elegir entre CLA, CENCO o ARAUCANA, y cerrar sesión.
- **Panel CLA** (`PanelCLA.jsx`): selector de período; tabs de Estado Cartera, Contactabilidad, Pagos, Reprogramaciones, Comparativo, Ejecutivos y Productividad; descarga de sábanas Excel de Pagos y Reprogramaciones.
- **Panel CENCO** (`PanelCenco.jsx`): selector de cartera (H1 / T4) y período; tabs de Estado Cartera, Contactabilidad, Pagos, Reprogramaciones, Comparativo y Ejecutivos.
- **Panel ARAUCANA** (`PanelAraucana.jsx`): selector de cartera (Juicio Ordinario, Caja La Araucana, Lipigas, Forum, Santander, Caja Los Andes, Cencosud); tabs de Estado Cartera, Notificación, Búsquedas Negativas y Embargo; descarga de CSV general y de embargo.
- Selector de tema claro/oscuro (`ThemeToggle.jsx` / `ThemeContext.jsx`), visible en toda la aplicación.

## Rutas principales del frontend

Definidas en `Frontend/src/App.jsx` (todas menos `/login` están protegidas y redirigen a `/login` si no hay sesión):

| Ruta | Componente | Acceso |
|---|---|---|
| `/login` | `Login` | Público |
| `/` | `MandanteSelector` | Protegida |
| `/panel/cla` | `PanelCLA` | Protegida |
| `/panel/cenco` | `PanelCenco` | Protegida |
| `/panel/araucana` | `PanelAraucana` | Protegida |

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

No se documentan aquí las consultas SQL completas; solo su propósito, siguiendo la política de este proyecto.

## Conexión con SQL Server

- El backend se conecta a SQL Server mediante SQLAlchemy con el dialecto `mssql+pyodbc` (`Backend/app/db/database.py`), usando `TrustServerCertificate=yes` y el driver ODBC configurado por `DB_ODBC_DRIVER`.
- Servidor, base de datos, usuario y contraseña se obtienen desde variables de entorno (ver sección "Variables de entorno"); no hay credenciales hardcodeadas en el código analizado.
- Las consultas usan principalmente tablas con prefijo `PANEL1_*` (CLA), `PANEL_CENCO_*` (Cencosud) y `PANEL_ARAUCANA_*` (La Araucana), además de `dbo.TBL_USERS` y `dbo.TBL_ROLES` para autenticación.
- Algunos endpoints de CLA ejecutan stored procedures (`SP_Panel1_Comparativo`, `SP_Panel1_Productividad`, `SP_Panel1_AvanceEtapa`, `SP_Panel1_Sabanas_Caja_Los_Andes`).
- Los endpoints de descarga de La Araucana consultan además un servidor vinculado (linked server) identificado en el código como `[PROMETEO\FASTCO].SISTEMA_JFASTCO`, con tablas como `tbl_resultados_sabana`, `TBL_CLASIFICACION_ESTADOS` y `TBL_JUICIO`. Esto implica que, además de la base principal, el entorno donde corra el backend debe tener conectividad y permisos hacia ese servidor vinculado.

## Autenticación y roles

- Autenticación basada en **JWT** (`Backend/app/core/security.py`), firmado con `JWT_SECRET_KEY` y algoritmo `JWT_ALGORITHM` (por defecto `HS256`), con expiración configurable vía `JWT_EXPIRE_MINUTES` (por defecto 480 minutos).
- Las contraseñas se verifican con `werkzeug.security.check_password_hash` contra un hash almacenado en `dbo.TBL_USERS.password_hash`; el backend nunca maneja contraseñas en texto plano más allá de la verificación puntual.
- El rol del usuario (`role`, código proveniente de `dbo.TBL_ROLES`) se incluye en el payload del JWT y se devuelve en `/auth/login` y `/auth/me`, pero en el código revisado **no se encontró lógica que restrinja el acceso a paneles o endpoints según el rol** (solo se exige estar autenticado). Esto queda como pendiente de confirmar si es el comportamiento esperado o si falta implementar autorización por rol.
- En el frontend, el token se guarda en `localStorage` (`Frontend/src/api/client.js`) y se envía como `Authorization: Bearer <token>` en cada request; las rutas protegidas (`ProtectedRoute` en `App.jsx`) solo verifican que exista un usuario autenticado, sin diferenciar por rol.

## Dependencias importantes

Ver secciones "Tecnologías utilizadas" para el detalle completo. Las de mayor impacto arquitectónico son:
- `fastapi` + `uvicorn`: framework y servidor ASGI del backend.
- `sqlalchemy` + `pyodbc`: acceso a SQL Server.
- `pyjwt` + `werkzeug`: autenticación (JWT y verificación de hash de password).
- `openpyxl`: generación de archivos Excel para descargas.
- `react`, `react-router-dom`, `recharts`, `vite`: base del frontend y sus gráficos.

## Troubleshooting básico

- **El backend no arranca / error de variable de entorno faltante**: revisar que el archivo `.env` en la raíz del proyecto contenga `DB_SERVER`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD` y `JWT_SECRET_KEY`, ya que se leen con `os.environ[...]` y no tienen valor por defecto.
- **Error de conexión a SQL Server / driver ODBC no encontrado**: verificar que el driver indicado en `DB_ODBC_DRIVER` (o el valor por defecto `ODBC Driver 17 for SQL Server`) esté instalado en el sistema donde corre el backend.
- **El frontend no puede llamar a la API (errores 404/CORS)**: en desarrollo, el frontend depende de que el backend esté corriendo en `http://localhost:8000` (target del proxy en `vite.config.js`); si el backend corre en otro host/puerto, hay que ajustar ese proxy o las reglas de `CORS_ORIGINS` en `Backend/app/core/config.py`.
- **401 al llamar a endpoints de panel**: los endpoints `/panel/*` requieren un JWT válido; verificar que el token no haya expirado (`JWT_EXPIRE_MINUTES`) y que se esté enviando el header `Authorization: Bearer <token>`.
- **Descargas de La Araucana (`/panel/araucana/descarga*`) fallan o devuelven 404**: estos endpoints dependen de conectividad al servidor vinculado `PROMETEO\FASTCO` / base `SISTEMA_JFASTCO`; validar que ese servidor esté accesible desde donde corre el backend.
- **Sin datos en un panel**: varios endpoints devuelven 404 con detalle "Sin datos" cuando la consulta no encuentra filas para el `periodo`/`cartera` seleccionado; probar con otro período o cartera.

---

Este documento fue generado a partir de una revisión directa del código fuente del proyecto (backend y frontend). Cualquier sección marcada como "pendiente de confirmar" debe validarse con el equipo antes de asumirse como definitiva.

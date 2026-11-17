# WACHTEL HOF — Asistente IA Backend

Backend puente entre el widget React (Panchita 🐦 / Asistente ⚙️) y Kiro CLI.

---

## Probar localmente

### 1. Iniciar el backend

```bash
cd "C:\Users\hmuller_note\Desktop\WACHTEL HOF\kiro-backend"
node server.js
```

Verás:
```
🥚 WACHTEL HOF — Asistente IA corriendo en http://localhost:3099
   POST /api/kiro-chat  →  Consultar al asistente
   GET  /               →  Health check
```

### 2. Iniciar la tienda (en otra terminal)

```bash
cd "C:\Users\hmuller_note\Desktop\WACHTEL HOF\08_APPS_CODIGO_FUENTE\tienda"
npm start
```

Abre http://localhost:3000 — verás el botón 🐦 en la esquina inferior derecha.

### 3. Iniciar el ERP (en otra terminal)

```bash
cd "C:\Users\hmuller_note\Desktop\WACHTEL HOF\08_APPS_CODIGO_FUENTE\erp\apps\admin"
npm run dev
```

Abre http://localhost:3001 — verás el botón ⚙️ en la esquina inferior derecha.

### 4. Probar el asistente

Escribe cualquier pregunta en el widget:
- **Tienda**: "¿Cuánto cuesta el envío a la Región de los Lagos?" 
- **ERP**: "¿Cómo registro una venta presencial?"

---

## Variables de entorno para las apps

### Tienda (crear `.env.local` en `tienda/`)
```
REACT_APP_KIRO_BACKEND_URL=http://localhost:3099
```

### ERP (crear `.env.local` en `erp/apps/admin/`)
```
NEXT_PUBLIC_KIRO_BACKEND_URL=http://localhost:3099
```

> En producción estas variables apuntarán a la URL de Render.

---

## Deploy en Render

1. Crear repo en GitHub solo con la carpeta `kiro-backend/`
2. Ir a render.com → New Web Service → conectar el repo
3. Render detecta `render.yaml` automáticamente
4. Deploy automático. URL tipo: `https://wachtelhof-asistente-ia.onrender.com`
5. Actualizar las variables de entorno en tienda y ERP con esa URL
6. Hacer deploy de ambas apps

---

## Requisito: Kiro CLI en el servidor

El servidor backend necesita tener `kiro-cli` instalado.

- **Local**: ya está instalado en tu equipo ✅
- **Render**: al hacer deploy, agregar en el Build Command:
  ```
  npm install && npm install -g kiro-cli
  ```
  Y configurar la carpeta `.kiro/` del proyecto como variable de entorno
  `KIRO_PROJECT_PATH` apuntando a donde están los steering files.

> Render Free tiene 512MB RAM y 0.1 CPU — suficiente para el asistente.
> Se "duerme" después de 15 min de inactividad, pero despierta automáticamente.

---

## Archivos del proyecto

```
kiro-backend/
├── server.js          ← Backend Express principal
├── package.json       ← Dependencias (express, cors)
├── render.yaml        ← Configuración automática Render
├── .env.example       ← Variables de entorno de referencia
└── README.md          ← Este archivo

tienda/src/components/
└── KiroHelpWidget.jsx ← Widget Panchita 🐦 para clientes

erp/src/components/
└── AsistenteERP.tsx   ← Asistente ⚙️ para el equipo
```

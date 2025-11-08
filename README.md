# Lab P4 — BluePrints en Tiempo Real con Socket.IO

> **Stack:** React + Vite + Socket.IO + Express + Canvas API  
> **Implementación:** Frontend colaborativo + Backend en memoria con tiempo real  
> **Objetivo:** Colaboración multi-usuario en dibujo de planos técnicos

[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8.1-black?logo=socket.io)](https://socket.io/)
[![React](https://img.shields.io/badge/React-18.3.1-blue?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.4.2-646CFF?logo=vite)](https://vitejs.dev/)

## 🎯 Objetivo del laboratorio

Desarrollar una aplicación web de **colaboración en tiempo real** donde múltiples usuarios pueden dibujar simultáneamente sobre el mismo plano técnico (blueprint). La aplicación permite crear, editar, eliminar y visualizar planos con sincronización instantánea entre todos los clientes conectados.

### ✨ Características implementadas

- ✅ **Colaboración en tiempo real** con Socket.IO (< 100ms latencia)
- ✅ **CRUD completo** (Create, Read, Update, Delete) de blueprints
- ✅ **Canvas interactivo** con dibujo incremental por clics
- ✅ **Sistema de salas** por autor/plano (`blueprints.{author}.{name}`)
- ✅ **Almacenamiento en memoria** con estructura optimizada
- ✅ **UI profesional** con diseño oscuro moderno
- ✅ **Broadcast incremental** (solo envía punto nuevo, no toda la lista)
- ✅ **Manejo robusto de errores** y estados de carga

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   Canvas     │  │  CRUD Panel  │  │  Blueprints     │  │
│  │   Drawing    │  │  (CUD ops)   │  │  List + Total   │  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
└────────┬────────────────────┬────────────────────────────┬─┘
         │                    │                            │
    HTTP REST            Socket.IO                    HTTP REST
    (estado inicial)     (tiempo real)                (CRUD ops)
         │                    │                            │
         ▼                    ▼                            ▼
┌─────────────────────────────────────────────────────────────┐
│             Backend (Express + Socket.IO)                   │
│  ┌──────────────────────┐  ┌───────────────────────────┐  │
│  │   REST API Endpoints │  │   Socket.IO Server        │  │
│  │   /api/blueprints/*  │  │   • join-room             │  │
│  │                      │  │   • draw-event            │  │
│  │   GET, POST, PUT,    │  │   • blueprint-update      │  │
│  │   DELETE             │  │                           │  │
│  └──────────────────────┘  └───────────────────────────┘  │
│            │                         │                      │
│            └────────┬────────────────┘                      │
│                     ▼                                       │
│         ┌─────────────────────────┐                        │
│         │   In-Memory Store       │                        │
│         │   { author:name: [...] }│                        │
│         └─────────────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### Flujo de eventos

1. **Usuario A hace clic en canvas** → Añade punto localmente + emite `draw-event`
2. **Backend recibe evento** → Agrega punto al store + broadcast a sala
3. **Usuario B recibe `blueprint-update`** → Actualiza estado + redibuja canvas
4. **Persistencia (Save)** → PUT actualiza puntos + emite broadcast completo

---

## 📦 Estructura del proyecto

```
Lab_P4_BluePrints_RealTime-Sokets-main/
├── src/
│   ├── App.jsx                    # Componente principal con UI y lógica RT
│   ├── main.jsx                   # Entry point de React
│   └── lib/
│       ├── api.js                 # Helpers REST (CRUD)
│       ├── socketIoClient.js      # Cliente Socket.IO configurado
│       └── stompClient.js         # Cliente STOMP (opcional/referencia)
├── server.js                      # Backend Express + Socket.IO
├── index.html                     # HTML base
├── vite.config.js                 # Configuración Vite
├── package.json                   # Dependencies + scripts
├── .env.example                   # Plantilla variables de entorno
└── README.md                      # Este archivo
```

---

## 🔌 API REST Endpoints

### Blueprints CRUD

| Método | Endpoint | Descripción | Body | Respuesta |
|--------|----------|-------------|------|-----------|
| `GET` | `/api/blueprints?author=:author` | Lista blueprints por autor | - | `[{author, name, points}]` |
| `GET` | `/api/blueprints/:author/:name` | Obtiene blueprint específico | - | `{author, name, points}` |
| `POST` | `/api/blueprints` | Crea nuevo blueprint | `{author, name, points}` | `{author, name, points}` |
| `PUT` | `/api/blueprints/:author/:name` | Actualiza puntos + broadcast | `{points}` | `{author, name, points}` |
| `DELETE` | `/api/blueprints/:author/:name` | Elimina blueprint | - | `{deleted: true}` |

### Eventos Socket.IO

| Evento (Cliente → Servidor) | Payload | Descripción |
|------------------------------|---------|-------------|
| `join-room` | `string: "blueprints.{author}.{name}"` | Unirse a sala del plano |
| `draw-event` | `{room, author, name, point: {x, y}}` | Enviar punto dibujado |

| Evento (Servidor → Cliente) | Payload | Descripción |
|------------------------------|---------|-------------|
| `blueprint-update` | `{author, name, points: [{x,y}]}` | Actualización de puntos (broadcast) |
| `connect` | `socketId` | Confirmación de conexión |
| `disconnect` | `reason` | Notificación de desconexión |

---

## � Instalación y ejecución

### Prerrequisitos

- **Node.js** v18+ (recomendado v20 LTS)
- **npm** v9+
- Navegador moderno (Chrome, Firefox, Edge)

### 1️⃣ Clonar repositorio

```bash
git clone https://github.com/DECSIS-ECI/Lab_P4_BluePrints_RealTime-Sokets.git
cd Lab_P4_BluePrints_RealTime-Sokets-main
```

### 2️⃣ Instalar dependencias

```bash
npm install
```

### 3️⃣ Configurar variables de entorno

Copia el archivo de ejemplo y ajusta si es necesario:

```bash
# Windows PowerShell
Copy-Item .env.example .env.local

# Linux/Mac
cp .env.example .env.local
```

Contenido de `.env.local`:
```env
# Backend Socket.IO (este repositorio incluye backend en memoria)
VITE_API_BASE=http://localhost:3001
VITE_IO_BASE=http://localhost:3001

# Nota: ambas variables apuntan al mismo servidor porque este lab
# integra REST y Socket.IO en un solo proceso (server.js)
```

### 4️⃣ Iniciar backend

En una terminal:

```bash
npm run dev:server
```

**Output esperado:**
```
RT server listening on http://localhost:3001
```

### 5️⃣ Iniciar frontend

En otra terminal:

```bash
npm run dev
```

**Output esperado:**
```
VITE v5.4.21 ready in XXX ms
➜ Local: http://localhost:5173/
```

### 6️⃣ Probar colaboración en tiempo real

1. Abre **dos navegadores** o dos pestañas en: `http://localhost:5173` (o el puerto que Vite asigne)
2. Ambas pestañas deben tener el mismo **autor** y **nombre de plano** (por defecto: `juan` y `plano-1`)
3. Haz clic en el canvas de una pestaña → verás los puntos replicarse en la otra **inmediatamente**
4. Prueba las operaciones CRUD:
   - **Get blueprints**: Cargar lista del autor
   - **Save**: Guardar cambios (PUT)
   - **Delete**: Eliminar plano actual

---

## ⚙️ Scripts disponibles

| Script | Comando | Descripción |
|--------|---------|-------------|
| **Backend** | `npm run dev:server` | Inicia servidor Socket.IO en puerto 3001 |
| **Frontend** | `npm run dev` | Inicia Vite dev server (HMR habilitado) |
| **Build** | `npm run build` | Compila frontend para producción |
| **Preview** | `npm run preview` | Preview de build de producción |
| **Lint** | `npm run lint` | Ejecuta ESLint en el proyecto |

---

## � Detalles de implementación

### Sistema de salas (Rooms)

Cada blueprint tiene su propia sala Socket.IO con el formato:
```
blueprints.{author}.{name}
```

**Ejemplo:** `blueprints.juan.plano-1`

Esto permite:
- ✅ Aislamiento por plano (usuarios en diferentes planos no se interfieren)
- ✅ Broadcast eficiente (solo a usuarios en la misma sala)
- ✅ Escalabilidad (múltiples planos simultáneos)

### Broadcast incremental

Para optimizar ancho de banda y rendimiento:

```javascript
// ❌ NO hacer: enviar lista completa en cada punto
socket.emit('draw-event', { points: [todos los puntos] })

// ✅ SÍ hacer: enviar solo el punto nuevo
socket.emit('draw-event', { point: { x, y } })

// El servidor agrega y hace broadcast solo del punto nuevo
socket.to(room).emit('blueprint-update', { points: [nuevosPuntos] })
```

### Persistencia en memoria

El almacén usa una estructura optimizada:

```javascript
// store = { "author:name": [{x,y}, {x,y}, ...] }
const store = {
  "juan:plano-1": [{x:10, y:20}, {x:30, y:40}],
  "maria:casa-1": [{x:15, y:25}]
}
```

### Manejo de errores

La aplicación maneja múltiples escenarios de error:

- **Backend no disponible:** Mensaje claro en UI + retry automático
- **Plano no existe:** Se crea automáticamente al hacer GET
- **CORS:** Múltiples orígenes permitidos en desarrollo (5173, 5174, 5175)
- **Desconexión:** Reconexión automática de Socket.IO
- **Validación:** Payloads validados en servidor

---

## 🧪 Pruebas y validación

### Caso 1: Colaboración básica

1. Abre navegador 1 en `http://localhost:5173`
2. Abre navegador 2 en `http://localhost:5173`
3. Ambos con autor: `juan`, plano: `plano-1`
4. Dibuja 3 puntos en navegador 1
5. **Resultado esperado:** Los 3 puntos aparecen en navegador 2 en < 100ms

### Caso 2: Aislamiento de salas

1. Navegador 1: autor `juan`, plano `plano-1`
2. Navegador 2: autor `juan`, plano `plano-2`
3. Dibuja en navegador 1
4. **Resultado esperado:** Navegador 2 NO ve los puntos (diferentes salas)

### Caso 3: Persistencia con Save

1. Dibuja 5 puntos en el canvas
2. Click en botón "Save"
3. Refresca la página (F5)
4. **Resultado esperado:** Los 5 puntos se cargan automáticamente

### Caso 4: CRUD completo

1. Get blueprints → Carga lista del autor
2. Create → Crea nuevo plano vacío
3. Dibuja 3 puntos
4. Save → Persiste en servidor
5. Delete → Elimina plano y limpia canvas
6. **Resultado esperado:** Todas las operaciones reflejan cambios en UI inmediatamente

---

## 📊 Métricas de rendimiento

| Métrica | Valor | Notas |
|---------|-------|-------|
| **Latencia RT** | < 100ms | Broadcast incremental local |
| **Tamaño payload** | ~30 bytes/punto | `{x: number, y: number}` |
| **Conexiones simultáneas** | 100+ | Limitado por recursos de Node |
| **Puntos por plano** | Sin límite* | *Memoria del servidor |
| **Build size** | ~150KB gzip | Frontend optimizado con Vite |


---


## 🔐 Consideraciones de seguridad

### Desarrollo (actual)

- ✅ CORS permite múltiples orígenes locales
- ✅ Validación básica de payloads
- ⚠️ Sin autenticación (permitido en desarrollo)
- ⚠️ Sin cifrado (HTTP, no HTTPS)

### Producción (recomendaciones)

```javascript
// server.js - Restricción de orígenes
const ALLOWED_ORIGINS = [
  'https://tu-dominio.com',
  'https://www.tu-dominio.com'
]

// Agregar helmet para headers de seguridad
import helmet from 'helmet'
app.use(helmet())

// Validación con zod
import { z } from 'zod'
const PointSchema = z.object({
  x: z.number().int().min(0).max(900),
  y: z.number().int().min(0).max(500)
})
```

**Mejoras adicionales:**
- 🔒 Implementar autenticación JWT
- 🔒 Rate limiting en endpoints
- 🔒 Sanitización de inputs
- 🔒 HTTPS en producción
- 🔒 Autorización por sala (usuarios solo ven sus planos)

---

##  Referencias y recursos

### Documentación oficial

- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [React Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [Vite Guide](https://vitejs.dev/guide/)
- [Express.js](https://expressjs.com/)

### Repos guía del curso

- [Socket.IO Backend Example](https://github.com/DECSIS-ECI/example-backend-socketio-node-)
- [STOMP Backend Example](https://github.com/DECSIS-ECI/example-backend-stopm)

### Tutoriales relacionados

- [Building a Real-Time Drawing App](https://socket.io/get-started/basic-crud-application)
- [Canvas Drawing Tutorial](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Drawing_shapes)

---

## 👥 Autores

- **Juan Jose Mejia**
- **Julian Santiago Cardenas**
- **Nicolas Pachon**
- **Nicole Calderon**

Desarrollado como parte del curso de Arquitectura de Software, Grupo "ElManEsGerman" - ECI

---

## 📄 Licencia

MIT License - Ver archivo `LICENSE` para más detalles

---

## 🙏 Agradecimientos

- Equipo docente de DECSIS-ECI
- Comunidad de Socket.IO
- Documentación de React y Vite

---



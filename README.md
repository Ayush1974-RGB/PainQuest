# MotionSense — Live Device Sensor PWA

Turn any smartphone into a live motion sensor. MotionSense streams gyroscope, accelerometer, and device orientation data from a mobile browser to a Node.js backend via WebSockets at up to 30 FPS, and exposes a REST API for consuming the latest sensor snapshot.

---

## Features

- **Real-time sensor streaming** — Gyroscope, accelerometer, and orientation data at 30 FPS
- **iOS 13+ permission support** — Handles `DeviceMotionEvent.requestPermission()`
- **Persistent Device ID** — UUID v4 stored in `localStorage`
- **WebSocket stream** — Socket.IO with automatic reconnection
- **REST API** — Query device info and latest sensor data by device ID
- **PWA** — Installable, offline-capable, works standalone on iOS and Android
- **Dark sensor-terminal UI** — Mono font, axis bars, live FPS counter

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables
cp .env.example .env.local
Add your variables
# Edit .env.local as needed (defaults work for local dev)

# 3. Run in development
npm run dev

# 4. Open on your phone
# http://<your-local-ip>:3000
# (must be HTTPS or localhost for sensor APIs to work on some browsers)
```

### Production

```bash
npm i
npm run build
npm run start
```

---

## API Reference

### `GET /api/device/:id`

Returns metadata for a connected device.

**Response 200**
```json
{
  "deviceId": "uuid-v4",
  "connectedAt": 1700000000000,
  "lastSeen": 1700000001000,
  "uptime": 1000,
  "hasSensorData": true
}
```

**Response 404** — device not found or disconnected.

---

### `GET /api/device/:id/sensor`

Returns the latest sensor snapshot.

**Response 200**
```json
{
  "deviceId": "uuid-v4",
  "timestamp": 1700000001000,
  "age": 42,
  "sensor": {
    "accelerometer": { "x": 0.12, "y": -9.81, "z": 0.04 },
    "gyroscope": { "x": 0.01, "y": -0.03, "z": 0.00 },
    "orientation": { "alpha": 123.4, "beta": -5.2, "gamma": 1.8, "absolute": false }
  }
}
```

**Response 204** — device connected but no data received yet.  
**Response 404** — device not found.

---

## Project Structure

```
motion-sensor-pwa/
├── server.js                    # Custom Node.js + Socket.IO server
├── next.config.js               # Next.js + next-pwa config
├── tailwind.config.js
├── public/
│   ├── manifest.json            # PWA manifest
│   └── icons/                   # App icons (192, 512, apple-touch)
└── src/
    ├── types/index.ts            # Shared TypeScript types
    ├── lib/
    │   ├── deviceId.ts           # UUID persistence
    │   ├── registry.ts           # In-memory device store
    │   └── socketServer.ts       # Socket.IO server init
    ├── hooks/
    │   ├── useMotionSensors.ts   # Sensor permission + event listeners
    │   └── useSocketStream.ts    # Socket.IO client + throttling
    ├── components/
    │   ├── StatusBadge.tsx
    │   ├── DeviceCard.tsx
    │   ├── PermissionGate.tsx
    │   └── SensorPanel.tsx
    └── app/
        ├── layout.tsx            # Root layout with metadata
        ├── page.tsx              # Main dashboard
        ├── globals.css
        └── api/device/[id]/
            ├── route.ts          # GET /api/device/:id
            └── sensor/route.ts   # GET /api/device/:id/sensor
```

---

## Deployment

### Vercel

> **Note:** Vercel's serverless runtime does not support persistent WebSockets. Deploy to a VPS or Railway for full WebSocket support.

### Render

```bash
npm run build
npm run start
```

Set `PORT` and `NEXT_PUBLIC_APP_URL` environment variables on your host.

### Docker (optional)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## Browser Compatibility

| Feature | Chrome Android | Safari iOS | Firefox Android |
|---|---|---|---|
| DeviceMotionEvent | ✅ | ✅ (13+, requires gesture) | ✅ |
| DeviceOrientationEvent | ✅ | ✅ | ✅ |
| WebSocket | ✅ | ✅ | ✅ |
| PWA Install | ✅ | ✅ (Add to Home Screen) | ⚠️ Partial |

**HTTPS is required** for sensor APIs on Chrome and Firefox. Use `localhost` for local development without SSL.

# Frontend

Interfaz administrativa React + TypeScript + Vite. En desarrollo, Vite reenvía `/api` a `http://localhost:3000`. En producción, Nginx sirve `dist` y proxy `/api/` hacia VM2.

```sh
npm install
npm run dev
npm run build
```

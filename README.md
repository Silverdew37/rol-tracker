# Rol Tracker 🎭

App web progresiva (PWA) para gestionar tiempos de respuesta en rol narrativo.
Instalable en Android desde GitHub Pages como si fuera una app nativa.

---

## ¿Qué hace?

- **Personajes propios**: añade todos tus personajes, cada uno con su juego/fandom.
- **Hilos por personaje**: por cada personaje, registra con quién tienes rol activo.
- **Control de turnos**: indica cuándo mandaste tu último mensaje y cuándo te respondieron. La app calcula automáticamente quién debe en cada hilo.
- **Días sin contestar**: muestra cuántos días llevas sin responder (contando desde el último mensaje del partner).
- **Tiempo de respuesta del partner**: calcula automáticamente cuántos días tardó en responderte.
- **Alarmas individuales**: configura el máximo de días que te permites tardar en cada hilo. La app avisa cuando queda 1 día y cuando se supera el límite.
- **Vista de urgentes**: pantalla principal con todos los hilos donde llevas 4+ días sin contestar, ordenados de más a menos urgente.
- **Vista de personaje**: lista de hilos dividida en "le debo yo" (color rojo) y "me deben a mí" (tenue/desactivado). Ordenada por días sin contestar.
- **Filtro por juego**: filtra personajes e hilos por juego/fandom, o muestra todos.
- **Sin servidor**: todos los datos se guardan en `localStorage` del navegador. No pesa casi nada (solo texto).

---

## Instalación en Android

1. Sube esta carpeta a un repositorio de GitHub.
2. Activa **GitHub Pages** en los ajustes del repositorio (rama `main`, carpeta raíz).
3. Abre la URL de GitHub Pages en **Chrome para Android**.
4. Menú (⋮) → **"Añadir a pantalla de inicio"**.
5. La app se instala como acceso directo y funciona offline.

---

## Estructura del proyecto

```
rol-tracker/
├── index.html          ← HTML principal (estructura de la app)
├── manifest.json       ← Configuración PWA (nombre, icono, colores)
├── sw.js               ← Service Worker (caché offline + notificaciones)
├── css/
│   └── style.css       ← Estilos (dark theme, mobile-first)
├── js/
│   ├── data.js         ← Capa de datos (localStorage, lógica de fechas)
│   ├── notifications.js← Gestión de alarmas y notificaciones push
│   ├── ui.js           ← Renderizado de todas las vistas y modales
│   └── app.js          ← Punto de entrada, inicialización, eventos globales
└── icons/
    ├── icon-192.png    ← Icono PWA (192×192)
    └── icon-512.png    ← Icono PWA (512×512)
```

---

## Cómo funciona la lógica de turnos

- **"Le debo yo"**: el último mensaje registrado es del partner (`theirLastMessage > myLastMessage`).
- **"Me deben a mí"**: el último mensaje registrado es mío (`myLastMessage > theirLastMessage`).
- **Días sin contestar**: se cuentan desde `theirLastMessage` hasta hoy (cuando es mi turno).
- **Días que tardó en responder**: se calculan automáticamente al registrar el mensaje del partner: `theirLastMessage - myLastMessage`.

---

## Ideas para futuras versiones

- [ ] Archivar hilos inactivos (sin borrarlos) en lugar de solo borrar.
- [ ] Exportar/importar datos en JSON para hacer copias de seguridad.
- [ ] Añadir notas libres a cada hilo (URL del hilo, plataforma, etc.).
- [ ] Estadísticas: tiempo medio de respuesta por personaje o por partner.
- [ ] Sync opcional entre dispositivos (Supabase free tier u otro backend gratuito).
- [ ] Tema claro (pergamino) como alternativa al tema oscuro actual.
- [ ] Sonido/vibración al saltar una alarma en primer plano.
- [ ] Notificaciones push verdaderas en segundo plano vía Web Push API + servidor mínimo (Cloudflare Workers gratis).

---

## Tecnologías usadas

- HTML5 + CSS3 + JavaScript (vanilla, sin frameworks)
- PWA: Web App Manifest + Service Worker
- Almacenamiento: `localStorage` (datos del navegador, locales al dispositivo)
- Notificaciones: Notifications API del navegador
- Fuentes: Playfair Display + Crimson Pro (Google Fonts)

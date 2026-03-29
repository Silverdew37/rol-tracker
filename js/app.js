/* ============================================================
   APP.JS — Punto de entrada principal
   Inicializa el service worker, los eventos globales y la UI.
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {

  /* ── 1. REGISTRAR SERVICE WORKER (PWA) ─────────────────── */
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
    } catch (err) {
      console.warn('SW no registrado:', err);
    }
  }

  /* ── 2. SOLICITAR PERMISO DE NOTIFICACIONES ─────────────── */
  await Notifs.requestPermission();

  /* ── 3. COMPROBAR ALARMAS AL ABRIR ──────────────────────── */
  Notifs.checkAll();

  // Programar comprobación automática a las 7:30am cada día
  Notifs.scheduleMorningCheck();

  // También comprobar cuando la app vuelve al primer plano
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') Notifs.checkAll();
  });

  /* ── 4. EVENTOS DE NAVEGACIÓN ───────────────────────────── */

  // Botones de la barra de navegación inferior
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      UI.currentView = btn.dataset.view;
      UI.render();
    });
  });

  // Botón volver (desde vista de detalle de personaje)
  document.getElementById('btn-back')?.addEventListener('click', () => {
    UI.currentView = 'characters';
    UI.render();
  });

  // Botón añadir personaje (cabecera)
  document.getElementById('btn-add-character')?.addEventListener('click', () => {
    UI.showAddCharModal();
  });

  // Filtro de juego
  document.getElementById('game-filter')?.addEventListener('change', e => {
    UI.currentGameFilter = e.target.value;
    UI.render();
  });

  /* ── 5. RENDER INICIAL ──────────────────────────────────── */
  UI.render();

});

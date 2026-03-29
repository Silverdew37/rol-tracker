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

  /* ── 5. MIGRACIÓN: calcular días de respuesta en hilos existentes ── */
  // Si hay hilos con ambas fechas pero sin días calculados, los calcula ahora.
  // Solo se ejecuta una vez (guarda flag en localStorage).
  if (!localStorage.getItem('rt_migrated_v1')) {
    const threads = DB.getThreads().map(t => {
      let { theirResponseDays, myResponseDays } = t;
      const { myLastMessage, theirLastMessage, lastTurn } = t;
      if (myLastMessage && theirLastMessage) {
        const diff = Math.round(
          (new Date(theirLastMessage) - new Date(myLastMessage)) / 86400000
        );
        // Su respuesta: si su fecha es posterior a la mía (o igual y ellos deben)
        if (theirResponseDays === null && diff > 0) theirResponseDays = diff;
        // Mi respuesta: si mi fecha es posterior a la suya (o igual y yo debo)
        if (myResponseDays === null && diff < 0) myResponseDays = Math.abs(diff);
        // Fechas iguales: usar lastTurn para asignar al que respondió
        if (diff === 0 && lastTurn === 'theirs' && theirResponseDays === null) theirResponseDays = 0;
        if (diff === 0 && lastTurn === 'mine'   && myResponseDays   === null) myResponseDays = 0;
      }
      return { ...t, theirResponseDays, myResponseDays };
    });
    DB._save(DB.KEYS.THREADS, threads);
    localStorage.setItem('rt_migrated_v1', '1');
  }

  /* ── 6. RENDER INICIAL ──────────────────────────────────── */
  UI.render();

});

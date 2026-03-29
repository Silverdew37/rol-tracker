/* ============================================================
   NOTIFICATIONS.JS — Lógica de alarmas y notificaciones push
   Las notificaciones se comprueban:
     1. Cada vez que la app se abre o vuelve al primer plano
     2. Automáticamente a las 7:30am mediante un temporizador
        que se programa al abrir la app
   ============================================================ */

const Notifs = {

  _morningTimer: null, // referencia al setTimeout del aviso de mañana

  /** Pide permiso de notificaciones al usuario (solo la primera vez). */
  async requestPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  },

  /**
   * Programa un setTimeout para las 7:30am del día actual (o siguiente
   * si ya han pasado las 7:30). Al dispararse, lanza checkAll() y se
   * reprograma para el día siguiente.
   * Se llama una vez al iniciar la app.
   */
  scheduleMorningCheck() {
    if (this._morningTimer) clearTimeout(this._morningTimer);

    const now    = new Date();
    const target = new Date();
    target.setHours(7, 30, 0, 0); // 7:30:00 am

    // Si ya pasaron las 7:30 de hoy, programar para mañana
    if (now >= target) target.setDate(target.getDate() + 1);

    const msUntil = target - now;

    this._morningTimer = setTimeout(() => {
      this.checkAll();
      this.scheduleMorningCheck(); // reprogramar para el día siguiente
    }, msUntil);
  },

  /**
   * Comprueba todos los hilos activos en los que le debo respuesta
   * y dispara notificaciones si:
   *   - Queda exactamente 1 día para el límite (maxDays - daysOwed === 1)
   *   - Se ha alcanzado o superado el límite (daysOwed >= maxDays)
   *
   * Guarda en localStorage la última vez que se notificó cada hilo
   * para evitar spam (máximo 1 notificación por hilo por día).
   */
  checkAll() {
    if (Notification.permission !== 'granted') return;

    const threads = DB.getThreads().filter(t => t.active);
    const chars   = DB.getCharacters();
    const today   = DB.today();

    // Registro de notificaciones ya enviadas hoy: { [threadId]: 'YYYY-MM-DD' }
    let notifLog = {};
    try {
      notifLog = JSON.parse(localStorage.getItem('rt_notif_log')) || {};
    } catch { notifLog = {}; }

    threads.forEach(thread => {
      if (DB.getTurn(thread) !== 'mine') return; // no es mi turno
      const daysOwed = DB.daysOwed(thread);
      if (daysOwed === null) return;

      const { maxDays, partnerName, characterId, id } = thread;
      const char     = chars.find(c => c.id === characterId);
      const charName = char ? char.name : 'tu personaje';

      // Solo notificar si aún no hemos notificado hoy este hilo
      if (notifLog[id] === today) return;

      let title = null;
      let body  = null;

      if (daysOwed >= maxDays) {
        title = `⏰ ¡Tiempo agotado! — ${charName}`;
        body  = `Llevas ${daysOwed} días sin contestar a ${partnerName}. Tu límite era ${maxDays} días.`;
      } else if (maxDays - daysOwed === 1) {
        title = `⚠️ ¡Último día! — ${charName}`;
        body  = `Mañana se cumple tu límite para contestar a ${partnerName}.`;
      }

      if (title) {
        this._send(title, body, id);
        notifLog[id] = today;
      }
    });

    localStorage.setItem('rt_notif_log', JSON.stringify(notifLog));
  },

  /**
   * Envía la notificación vía Service Worker si está disponible,
   * o directamente con la Notifications API si no.
   */
  _send(title, body, tag) {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title,
        body,
        tag
      });
    } else {
      new Notification(title, { body, tag, icon: './icons/icon-192.png' });
    }
  }

};

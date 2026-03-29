/* ============================================================
   NOTIFICATIONS.JS — Lógica de alarmas y notificaciones push
   Las notificaciones se comprueban cada vez que la app se abre
   o se vuelve a poner en primer plano. Se usa la Notifications API
   del navegador, que el service worker puede lanzar incluso con la
   app en segundo plano (si el navegador lo permite en Android).
   ============================================================ */

const Notifs = {

  /** Pide permiso de notificaciones al usuario (solo la primera vez). */
  async requestPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  },

  /**
   * Comprueba todos los hilos activos en los que le debo respuesta
   * y dispara notificaciones si:
   *   - Queda exactamente 1 día para el límite (maxDays - daysOwed === 1)
   *   - Se ha superado el límite (daysOwed >= maxDays)
   *
   * Guarda en localStorage la última vez que se notificó cada hilo
   * para evitar spam (máximo 1 notificación por hilo por día).
   */
  checkAll() {
    if (Notification.permission !== 'granted') return;

    const threads   = DB.getThreads().filter(t => t.active);
    const chars     = DB.getCharacters();
    const today     = DB.today();
    // Registro de notificaciones ya enviadas hoy: { [threadId]: 'YYYY-MM-DD' }
    let notifLog    = {};
    try {
      notifLog = JSON.parse(localStorage.getItem('rt_notif_log')) || {};
    } catch { notifLog = {}; }

    threads.forEach(thread => {
      if (DB.getTurn(thread) !== 'mine') return; // no es mi turno
      const daysOwed = DB.daysOwed(thread);
      if (daysOwed === null) return;

      const { maxDays, partnerName, characterId, id } = thread;
      const char = chars.find(c => c.id === characterId);
      const charName = char ? char.name : 'tu personaje';

      // Solo notificar si aún no hemos notificado hoy este hilo
      if (notifLog[id] === today) return;

      let title = null;
      let body  = null;

      if (daysOwed >= maxDays) {
        // ¡Pasado el límite!
        title = `⏰ ¡Tiempo agotado! — ${charName}`;
        body  = `Llevas ${daysOwed} días sin contestar a ${partnerName}. Tu límite era ${maxDays} días.`;
      } else if (maxDays - daysOwed === 1) {
        // Queda 1 día
        title = `⚠️ ¡Último día! — ${charName}`;
        body  = `Mañana se cumple tu límite para contestar a ${partnerName}.`;
      }

      if (title) {
        this._send(title, body, id);
        notifLog[id] = today; // marcar como notificado hoy
      }
    });

    localStorage.setItem('rt_notif_log', JSON.stringify(notifLog));
  },

  /**
   * Envía la notificación vía Service Worker si está disponible,
   * o directamente con la API si no.
   */
  _send(title, body, tag) {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      // Preferimos el SW para que funcione en segundo plano
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title,
        body,
        tag
      });
    } else {
      // Fallback: notificación directa desde la página
      new Notification(title, { body, tag, icon: './icons/icon-192.png' });
    }
  }

};

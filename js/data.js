/* ============================================================
   DATA.JS — Capa de datos (localStorage)
   Toda la lógica de lectura/escritura de datos.
   Estructura de datos:
     - characters[]: array de personajes propios
     - threads[]:    array de hilos de rol (relaciones entre personajes)
   ============================================================ */

const DB = {

  /* ── CLAVES DE ALMACENAMIENTO ─────────────────────────── */
  KEYS: {
    CHARACTERS: 'rt_characters',
    THREADS:    'rt_threads'
  },

  /* ── HELPERS GENÉRICOS ────────────────────────────────── */

  /** Lee y parsea un array de localStorage. Devuelve [] si no existe. */
  _load(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch {
      return [];
    }
  },

  /** Serializa y guarda un array en localStorage. */
  _save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  },

  /** Genera un ID único basado en timestamp + random. */
  _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  },

  /* ── PERSONAJES (characters) ──────────────────────────── */
  /*
   * Estructura de un personaje:
   * {
   *   id:      string   — identificador único
   *   name:    string   — nombre del personaje
   *   game:    string   — juego/fandom al que pertenece
   * }
   */

  /** Devuelve todos los personajes propios. */
  getCharacters() {
    return this._load(this.KEYS.CHARACTERS);
  },

  /** Guarda un personaje nuevo. Devuelve el personaje creado. */
  addCharacter(name, game) {
    const chars = this.getCharacters();
    const newChar = { id: this._uid(), name: name.trim(), game: game.trim() };
    chars.push(newChar);
    this._save(this.KEYS.CHARACTERS, chars);
    return newChar;
  },

  /** Edita nombre o juego de un personaje existente. */
  editCharacter(id, name, game) {
    const chars = this.getCharacters().map(c =>
      c.id === id ? { ...c, name: name.trim(), game: game.trim() } : c
    );
    this._save(this.KEYS.CHARACTERS, chars);
  },

  /** Elimina un personaje y todos sus hilos asociados. */
  deleteCharacter(id) {
    const chars = this.getCharacters().filter(c => c.id !== id);
    this._save(this.KEYS.CHARACTERS, chars);
    // Eliminar también todos los hilos de este personaje
    const threads = this.getThreads().filter(t => t.characterId !== id);
    this._save(this.KEYS.THREADS, threads);
  },

  /**
   * Guarda el array de personajes en el nuevo orden.
   * Se llama tras un drag & drop con el array ya reordenado.
   * @param {array} orderedChars — array completo de personajes en el orden deseado
   */
  reorderCharacters(orderedChars) {
    this._save(this.KEYS.CHARACTERS, orderedChars);
  },

  /** Devuelve todos los juegos únicos (para el filtro). */
  getGames() {
    const chars = this.getCharacters();
    return [...new Set(chars.map(c => c.game).filter(Boolean))].sort();
  },

  /* ── HILOS (threads) ──────────────────────────────────── */
  /*
   * Estructura de un hilo:
   * {
   *   id:              string   — identificador único
   *   characterId:     string   — ID del personaje propio
   *   partnerName:     string   — nombre del personaje (o escritora) partner
   *   myLastMessage:   string|null — fecha ISO (YYYY-MM-DD) de mi último mensaje
   *   theirLastMessage:string|null — fecha ISO de su último mensaje
   *   maxDays:         number   — días máximos que me permito tardar en contestar
   *   active:          boolean  — hilo activo (true) o archivado (false)
   * }
   *
   * LÓGICA DE TURNOS:
   *   - "Le debo yo"    → theirLastMessage > myLastMessage  (o myLastMessage es null)
   *   - "Me deben a mí" → myLastMessage > theirLastMessage  (o theirLastMessage es null)
   *
   * CÁLCULO DE TIEMPOS:
   *   - Días que llevo sin contestar  = hoy - theirLastMessage  (cuando le debo yo)
   *   - Días que tardó en contestarme = theirLastMessage - myLastMessage anterior
   *     → guardamos ese dato calculado automáticamente como 'theirResponseDays'
   */

  /** Devuelve todos los hilos. */
  getThreads() {
    return this._load(this.KEYS.THREADS);
  },

  /** Devuelve los hilos de un personaje concreto. */
  getThreadsByCharacter(characterId) {
    return this.getThreads().filter(t => t.characterId === characterId);
  },

  /**
   * Añade un hilo nuevo.
   * @param {string} characterId
   * @param {string} partnerName
   * @param {number} maxDays
   * @returns {object} hilo creado
   */
  addThread(characterId, partnerName, maxDays) {
    const threads = this.getThreads();
    const newThread = {
      id:                this._uid(),
      characterId,
      partnerName:       partnerName.trim(),
      myLastMessage:     null,   // aún no hemos enviado nada
      theirLastMessage:  null,   // aún no nos han enviado nada
      theirResponseDays: null,   // días que tardaron en responder (calculado)
      maxDays:           parseInt(maxDays) || 3,
      active:            true
    };
    threads.push(newThread);
    this._save(this.KEYS.THREADS, threads);
    return newThread;
  },

  /**
   * Actualiza las fechas de un hilo.
   * Calcula automáticamente theirResponseDays cuando se registra
   * un nuevo mensaje del partner (theirLastMessage).
   */
  updateThreadDates(id, myLastMessage, theirLastMessage) {
    const threads = this.getThreads().map(t => {
      if (t.id !== id) return t;

      let theirResponseDays = t.theirResponseDays;

      // Si hay nuevo mensaje del partner y tenemos fecha de nuestro último mensaje,
      // calculamos cuántos días tardaron en responder.
      if (
        theirLastMessage &&
        t.myLastMessage &&
        theirLastMessage !== t.theirLastMessage // realmente es nuevo
      ) {
        const prev = new Date(t.myLastMessage);
        const resp = new Date(theirLastMessage);
        const diff = Math.round((resp - prev) / (1000 * 60 * 60 * 24));
        if (diff >= 0) theirResponseDays = diff;
      }

      return {
        ...t,
        myLastMessage:    myLastMessage    || t.myLastMessage,
        theirLastMessage: theirLastMessage || t.theirLastMessage,
        theirResponseDays
      };
    });
    this._save(this.KEYS.THREADS, threads);
  },

  /** Edita configuración de un hilo (nombre partner, maxDays). */
  editThread(id, partnerName, maxDays) {
    const threads = this.getThreads().map(t =>
      t.id === id
        ? { ...t, partnerName: partnerName.trim(), maxDays: parseInt(maxDays) || 3 }
        : t
    );
    this._save(this.KEYS.THREADS, threads);
  },

  /** Elimina un hilo. */
  deleteThread(id) {
    const threads = this.getThreads().filter(t => t.id !== id);
    this._save(this.KEYS.THREADS, threads);
  },

  /* ── UTILIDADES DE FECHAS ─────────────────────────────── */

  /** Devuelve la fecha de hoy en formato YYYY-MM-DD. */
  today() {
    return new Date().toISOString().split('T')[0];
  },

  /**
   * Calcula días entre dos fechas ISO.
   * @param {string} from  — fecha más antigua (YYYY-MM-DD)
   * @param {string} to    — fecha más reciente (YYYY-MM-DD), por defecto hoy
   * @returns {number|null}
   */
  daysBetween(from, to = null) {
    if (!from) return null;
    const d1 = new Date(from);
    const d2 = to ? new Date(to) : new Date();
    // Normalizar a medianoche para evitar diferencias por hora
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
  },

  /**
   * Para cada hilo, determina el turno actual.
   * @returns {'mine'|'theirs'|'unknown'}
   *   mine   → le debo yo respuesta
   *   theirs → me deben a mí
   *   unknown → no hay fechas todavía
   */
  getTurn(thread) {
    const { myLastMessage, theirLastMessage } = thread;
    if (!myLastMessage && !theirLastMessage) return 'unknown';
    if (!myLastMessage) return 'mine';    // ellos escribieron, yo no he respondido aún
    if (!theirLastMessage) return 'theirs'; // yo escribí, ellos no han respondido
    return theirLastMessage > myLastMessage ? 'mine' : 'theirs';
  },

  /**
   * Días que llevo sin contestar (turno mío).
   * Se cuenta desde el ÚLTIMO mensaje del partner.
   */
  daysOwed(thread) {
    if (this.getTurn(thread) !== 'mine') return null;
    return this.daysBetween(thread.theirLastMessage);
  }

};

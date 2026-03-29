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
   * @param {string}  characterId
   * @param {string}  partnerName
   * @param {number}  maxDays
   * @param {boolean} favorite    — marcar como favorito
   * @returns {object} hilo creado
   */
  addThread(characterId, partnerName, maxDays, favorite = false) {
    const threads = this.getThreads();
    const newThread = {
      id:               this._uid(),
      characterId,
      partnerName:      partnerName.trim(),
      myLastMessage:    null,   // fecha ISO de mi último mensaje
      theirLastMessage: null,   // fecha ISO de su último mensaje
      theirResponseDays: null,  // días que tardó el partner en responderme (calculado)
      myResponseDays:   null,   // días que tardé yo en responder al partner (calculado)
      maxDays:          parseInt(maxDays) || 3,
      favorite:         !!favorite,
      active:           true
    };
    threads.push(newThread);
    this._save(this.KEYS.THREADS, threads);
    return newThread;
  },

  /**
   * Actualiza las fechas de un hilo.
   * Recibe lastTurn ('mine'|'theirs') explícito para cuando las fechas coinciden.
   * Calcula automáticamente:
   *   - theirResponseDays: días que tardó el partner en responder a mi último mensaje
   *   - myResponseDays:    días que tardé yo en responder al último mensaje del partner
   */
  updateThreadDates(id, myLastMessage, theirLastMessage, lastTurn) {
    const threads = this.getThreads().map(t => {
      if (t.id !== id) return t;

      let { theirResponseDays, myResponseDays } = t;

      // Nuevo mensaje del partner → calculamos cuánto tardó en responderme
      // (desde mi último mensaje previo hasta el suyo nuevo)
      if (theirLastMessage && t.myLastMessage && theirLastMessage !== t.theirLastMessage) {
        const diff = Math.round(
          (new Date(theirLastMessage) - new Date(t.myLastMessage)) / 86400000
        );
        if (diff >= 0) theirResponseDays = diff;
      }

      // Nuevo mensaje mío → calculamos cuánto tardé en responder al partner
      // (desde el último mensaje del partner hasta mi nuevo mensaje)
      if (myLastMessage && t.theirLastMessage && myLastMessage !== t.myLastMessage) {
        const diff = Math.round(
          (new Date(myLastMessage) - new Date(t.theirLastMessage)) / 86400000
        );
        if (diff >= 0) myResponseDays = diff;
      }

      return {
        ...t,
        myLastMessage:     myLastMessage    || t.myLastMessage,
        theirLastMessage:  theirLastMessage || t.theirLastMessage,
        theirResponseDays,
        myResponseDays,
        lastTurn:          lastTurn !== undefined ? lastTurn : t.lastTurn
      };
    });
    this._save(this.KEYS.THREADS, threads);
  },

  /** Edita configuración de un hilo (nombre partner, maxDays, favorite). */
  editThread(id, partnerName, maxDays, favorite) {
    const threads = this.getThreads().map(t =>
      t.id === id
        ? { ...t, partnerName: partnerName.trim(), maxDays: parseInt(maxDays) || 3, favorite: !!favorite }
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
   * Usa el campo lastTurn cuando las fechas coinciden o para desambiguar.
   * @returns {'mine'|'theirs'|'unknown'}
   *   mine   → le debo yo respuesta
   *   theirs → me deben a mí
   *   unknown → no hay fechas todavía
   */
  getTurn(thread) {
    const { myLastMessage, theirLastMessage, lastTurn } = thread;
    if (!myLastMessage && !theirLastMessage) return 'unknown';
    if (!myLastMessage) return 'mine';
    if (!theirLastMessage) return 'theirs';
    // Si las fechas son distintas, la más reciente manda
    if (theirLastMessage > myLastMessage) return 'mine';
    if (myLastMessage > theirLastMessage) return 'theirs';
    // Fechas iguales: usar el turno guardado explícitamente
    if (lastTurn) return lastTurn;
    // Sin lastTurn y fechas iguales: ambiguo, pedir aclaración
    return 'unknown';
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

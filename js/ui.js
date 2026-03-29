/* ============================================================
   UI.JS — Renderizado de vistas
   Tres vistas principales:
     1. Dashboard  — hilos urgentes de todos los personajes
     2. Characters — lista de personajes con filtro por juego
     3. Character  — detalle de un personaje con sus hilos
   ============================================================ */

const UI = {

  /* ── ESTADO DE LA UI ──────────────────────────────────── */
  currentView:      'dashboard', // 'dashboard' | 'characters' | 'character'
  currentCharId:    null,        // ID del personaje activo en vista detalle
  currentGameFilter: 'all',      // filtro de juego activo

  /* ── ENTRADA PRINCIPAL ────────────────────────────────── */

  /** Renderiza la vista activa. Llamado tras cualquier cambio de datos. */
  render() {
    this._updateNav();
    this._updateGameFilter();

    if (this.currentView === 'dashboard') {
      this._renderDashboard();
    } else if (this.currentView === 'characters') {
      this._renderCharacters();
    } else if (this.currentView === 'character') {
      this._renderCharacterDetail(this.currentCharId);
    }
  },

  /* ── NAV ──────────────────────────────────────────────── */

  _updateNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === this.currentView);
    });
    // El botón "volver" solo aparece en vista de detalle
    const backBtn = document.getElementById('btn-back');
    if (backBtn) backBtn.style.display = this.currentView === 'character' ? 'flex' : 'none';
  },

  /* ── FILTRO DE JUEGO ──────────────────────────────────── */

  _updateGameFilter() {
    const sel = document.getElementById('game-filter');
    if (!sel) return;
    const games = DB.getGames();
    // Reconstruir opciones preservando la selección actual
    sel.innerHTML = '<option value="all">Todos los juegos</option>';
    games.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = g;
      if (g === this.currentGameFilter) opt.selected = true;
      sel.appendChild(opt);
    });
  },

  /* ══════════════════════════════════════════════════════
     VISTA 1: DASHBOARD
     Muestra los hilos urgentes (≥4 días sin contestar)
     de todos los personajes, ordenados de más a menos urgente.
  ══════════════════════════════════════════════════════ */

  _renderDashboard() {
    const main = document.getElementById('main-content');

    // Recoger todos los hilos donde le debo y llevo ≥4 días
    let threads = DB.getThreads().filter(t => t.active);
    const chars = DB.getCharacters();

    // Aplicar filtro de juego
    const filteredCharIds = this.currentGameFilter === 'all'
      ? chars.map(c => c.id)
      : chars.filter(c => c.game === this.currentGameFilter).map(c => c.id);

    threads = threads.filter(t => filteredCharIds.includes(t.characterId));

    // Solo los que le debo yo y llevan ≥4 días
    const urgent = threads
      .filter(t => DB.getTurn(t) === 'mine' && DB.daysOwed(t) >= 4)
      .map(t => ({ ...t, _daysOwed: DB.daysOwed(t) }))
      .sort((a, b) => b._daysOwed - a._daysOwed); // más días = más arriba

    // HTML de la vista
    main.innerHTML = `
      <section class="dashboard">
        <h2 class="view-title">Pendientes urgentes
          <span class="badge ${urgent.length > 0 ? 'badge-alert' : ''}">${urgent.length}</span>
        </h2>
        ${urgent.length === 0
          ? `<p class="empty-state">✨ Todo al día. No hay hilos con 4+ días de espera.</p>`
          : `<ul class="thread-list">
              ${urgent.map(t => this._threadCardDashboard(t, chars)).join('')}
             </ul>`
        }
      </section>
    `;

    // Eventos: clic en tarjeta → va al personaje
    main.querySelectorAll('[data-char-id]').forEach(el => {
      el.addEventListener('click', () => {
        this.currentCharId = el.dataset.charId;
        this.currentView   = 'character';
        this.render();
      });
    });
  },

  /** Tarjeta de hilo urgente en el dashboard */
  _threadCardDashboard(thread, chars) {
    const char     = chars.find(c => c.id === thread.characterId);
    const charName = char ? char.name : '?';
    const game     = char ? char.game : '';
    const days     = thread._daysOwed;
    const urgency  = days >= thread.maxDays ? 'overdue' : 'warning';
    const label    = days >= thread.maxDays
      ? `¡${days}d — límite superado!`
      : `${days}d — queda ${thread.maxDays - days}d`;

    return `
      <li class="thread-card urgency-${urgency}" data-char-id="${thread.characterId}">
        <div class="tc-left">
          <span class="tc-char">${charName}</span>
          <span class="tc-game">${game}</span>
          <span class="tc-partner">↩ ${thread.partnerName}</span>
        </div>
        <div class="tc-right">
          <span class="tc-days">${label}</span>
        </div>
      </li>
    `;
  },

  /* ══════════════════════════════════════════════════════
     VISTA 2: LISTA DE PERSONAJES
  ══════════════════════════════════════════════════════ */

  _renderCharacters() {
    const main = document.getElementById('main-content');
    // Todos los personajes en su orden guardado
    const allChars = DB.getCharacters();
    // Para mostrar, filtramos por juego si hace falta
    const chars = this.currentGameFilter === 'all'
      ? allChars
      : allChars.filter(c => c.game === this.currentGameFilter);

    main.innerHTML = `
      <section class="characters-view">
        <h2 class="view-title">Mis personajes
          <span class="drag-hint">mantén para ordenar</span>
        </h2>
        ${chars.length === 0
          ? `<p class="empty-state">Aún no tienes personajes. Pulsa <strong>+ Personaje</strong> para empezar.</p>`
          : `<ul class="char-list" id="char-list-sortable">
              ${chars.map(c => this._charCard(c)).join('')}
             </ul>`
        }
      </section>
    `;

    // Clic en personaje → vista detalle
    main.querySelectorAll('.char-item').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('.char-actions')) return;
        this.currentCharId = el.dataset.id;
        this.currentView   = 'character';
        this.render();
      });
    });

    // Botones editar
    main.querySelectorAll('.btn-edit-char').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._showEditCharModal(btn.dataset.id);
      });
    });

    // Botones borrar
    main.querySelectorAll('.btn-del-char').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._confirmDelete(
          '¿Borrar este personaje y todos sus hilos?',
          () => { DB.deleteCharacter(btn.dataset.id); this.render(); }
        );
      });
    });

    // Inicializar drag & drop si hay lista
    const list = document.getElementById('char-list-sortable');
    if (list) this._initDragSort(list, allChars);
  },

  /**
   * Drag & drop táctil y de ratón para reordenar la lista de personajes.
   * Funciona con touch (móvil) y mouse (escritorio).
   * Al soltar, guarda el nuevo orden en localStorage.
   *
   * @param {HTMLElement} list      — el <ul> a ordenar
   * @param {array}       allChars  — array completo sin filtrar (para preservar
   *                                  personajes de otros juegos en el orden global)
   */
  _initDragSort(list, allChars) {
    let dragging   = null;  // elemento que se está arrastrando
    let placeholder = null; // elemento fantasma que ocupa el hueco
    let startY     = 0;
    let offsetY    = 0;     // distancia del dedo al borde superior del elemento

    // ── Crear placeholder (hueco visual) ──────────────────
    const makePlaceholder = (height) => {
      const ph = document.createElement('li');
      ph.className = 'drag-placeholder';
      ph.style.height = height + 'px';
      return ph;
    };

    // ── Obtener el elemento <li> más cercano al punto Y ───
    const getItemAtY = (y) => {
      const items = [...list.querySelectorAll('.char-item:not(.dragging)')];
      for (const item of items) {
        const rect = item.getBoundingClientRect();
        if (y < rect.top + rect.height / 2) return item;
      }
      return null; // insertar al final
    };

    // ── Guardar nuevo orden ────────────────────────────────
    const saveOrder = () => {
      // IDs en el orden actual del DOM (sin el placeholder)
      const newOrder = [...list.querySelectorAll('.char-item')]
        .map(el => el.dataset.id);

      // Reconstruir allChars en ese orden, preservando personajes
      // que puedan estar filtrados (no visibles pero existentes)
      const visible   = new Set(newOrder);
      const invisible = allChars.filter(c => !visible.has(c.id));
      const ordered   = [
        ...newOrder.map(id => allChars.find(c => c.id === id)),
        ...invisible
      ].filter(Boolean);

      DB.reorderCharacters(ordered);
    };

    // ══════════════════════════════════════════════════════
    // TOUCH (móvil)
    // ══════════════════════════════════════════════════════
    list.addEventListener('touchstart', e => {
      const handle = e.target.closest('.drag-handle');
      if (!handle) return;
      e.preventDefault(); // evita scroll mientras arrastra

      dragging = handle.closest('.char-item');
      const rect = dragging.getBoundingClientRect();
      startY  = e.touches[0].clientY;
      offsetY = startY - rect.top;

      placeholder = makePlaceholder(rect.height);
      dragging.classList.add('dragging');
      // Posición fija sobre la lista
      dragging.style.top   = rect.top + 'px';
      dragging.style.width = rect.width + 'px';
      list.insertBefore(placeholder, dragging.nextSibling);
    }, { passive: false });

    list.addEventListener('touchmove', e => {
      if (!dragging) return;
      e.preventDefault();
      const y = e.touches[0].clientY;
      dragging.style.top = (y - offsetY) + 'px';

      // Mover placeholder al hueco correcto
      const target = getItemAtY(y);
      if (target && target !== placeholder) {
        list.insertBefore(placeholder, target);
      } else if (!target) {
        list.appendChild(placeholder);
      }
    }, { passive: false });

    list.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging.classList.remove('dragging');
      dragging.style.top   = '';
      dragging.style.width = '';
      placeholder.replaceWith(dragging);
      placeholder = null;
      saveOrder();
      dragging = null;
    });

    // ══════════════════════════════════════════════════════
    // MOUSE (escritorio)
    // ══════════════════════════════════════════════════════
    list.addEventListener('mousedown', e => {
      const handle = e.target.closest('.drag-handle');
      if (!handle) return;
      e.preventDefault();

      dragging = handle.closest('.char-item');
      const rect = dragging.getBoundingClientRect();
      offsetY = e.clientY - rect.top;

      placeholder = makePlaceholder(rect.height);
      dragging.classList.add('dragging');
      dragging.style.top   = rect.top + 'px';
      dragging.style.width = rect.width + 'px';
      list.insertBefore(placeholder, dragging.nextSibling);

      const onMove = ev => {
        dragging.style.top = (ev.clientY - offsetY) + 'px';
        const target = getItemAtY(ev.clientY);
        if (target && target !== placeholder) list.insertBefore(placeholder, target);
        else if (!target) list.appendChild(placeholder);
      };
      const onUp = () => {
        dragging.classList.remove('dragging');
        dragging.style.top   = '';
        dragging.style.width = '';
        placeholder.replaceWith(dragging);
        placeholder = null;
        saveOrder();
        dragging = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });
  },

  /** Tarjeta de personaje en la lista */
  _charCard(char) {
    const threads  = DB.getThreadsByCharacter(char.id);
    const pending  = threads.filter(t => t.active && DB.getTurn(t) === 'mine').length;
    return `
      <li class="char-item" data-id="${char.id}">
        <span class="drag-handle" title="Mantén pulsado para ordenar">⠿</span>
        <div class="char-info">
          <span class="char-name">${char.name}</span>
          <span class="char-game">${char.game || '—'}</span>
        </div>
        <div class="char-meta">
          ${pending > 0 ? `<span class="badge badge-alert">${pending} pendiente${pending > 1 ? 's' : ''}</span>` : ''}
          <div class="char-actions">
            <button class="btn-icon btn-edit-char" data-id="${char.id}" title="Editar">✏️</button>
            <button class="btn-icon btn-del-char"  data-id="${char.id}" title="Borrar">🗑️</button>
          </div>
        </div>
      </li>
    `;
  },

  /* ══════════════════════════════════════════════════════
     VISTA 3: DETALLE DE PERSONAJE
     Lista de hilos dividida en:
       A) Le debo yo — ordenados por días desde su último mensaje (más días arriba)
       B) Me deben a mí — más tenues visualmente
  ══════════════════════════════════════════════════════ */

  _renderCharacterDetail(charId) {
    const main   = document.getElementById('main-content');
    const char   = DB.getCharacters().find(c => c.id === charId);
    if (!char) { this.currentView = 'characters'; this.render(); return; }

    const threads = DB.getThreadsByCharacter(charId).filter(t => t.active);

    // Separar por turno
    const mine   = threads
      .filter(t => DB.getTurn(t) === 'mine')
      .map(t => ({ ...t, _days: DB.daysOwed(t) ?? 0 }))
      .sort((a, b) => b._days - a._days); // más días sin contestar = más arriba

    const theirs  = threads.filter(t => DB.getTurn(t) === 'theirs');
    const unknown = threads.filter(t => DB.getTurn(t) === 'unknown');

    main.innerHTML = `
      <section class="char-detail">
        <div class="char-detail-header">
          <div>
            <h2 class="char-detail-name">${char.name}</h2>
            <span class="char-game">${char.game || '—'}</span>
          </div>
          <button class="btn-primary btn-sm" id="btn-add-thread">+ Hilo</button>
        </div>

        <!-- SECCIÓN: Le debo yo -->
        ${mine.length > 0 ? `
          <h3 class="section-label label-mine">Le debo yo</h3>
          <ul class="thread-list">
            ${mine.map(t => this._threadRow(t, 'mine')).join('')}
          </ul>
        ` : ''}

        <!-- SECCIÓN: Sin turno definido aún -->
        ${unknown.length > 0 ? `
          <h3 class="section-label label-unknown">Sin mensajes aún</h3>
          <ul class="thread-list">
            ${unknown.map(t => this._threadRow(t, 'unknown')).join('')}
          </ul>
        ` : ''}

        <!-- SECCIÓN: Me deben a mí -->
        ${theirs.length > 0 ? `
          <h3 class="section-label label-theirs">Me deben a mí</h3>
          <ul class="thread-list thread-list--dim">
            ${theirs.map(t => this._threadRow(t, 'theirs')).join('')}
          </ul>
        ` : ''}

        ${threads.length === 0
          ? `<p class="empty-state">No hay hilos. Pulsa <strong>+ Hilo</strong> para añadir.</p>`
          : ''}
      </section>
    `;

    // Botón añadir hilo
    document.getElementById('btn-add-thread').addEventListener('click', () => {
      this._showAddThreadModal(charId);
    });

    // Botones de los hilos
    main.querySelectorAll('.btn-thread-dates').forEach(btn => {
      btn.addEventListener('click', () => this._showDatesModal(btn.dataset.id));
    });
    main.querySelectorAll('.btn-thread-edit').forEach(btn => {
      btn.addEventListener('click', () => this._showEditThreadModal(btn.dataset.id));
    });
    main.querySelectorAll('.btn-thread-del').forEach(btn => {
      btn.addEventListener('click', () => {
        this._confirmDelete('¿Borrar este hilo?', () => {
          DB.deleteThread(btn.dataset.id);
          this.render();
        });
      });
    });
  },

  /** Fila de hilo en el detalle de personaje */
  _threadRow(thread, turn) {
    const daysOwed = turn === 'mine' ? (thread._days ?? 0) : null;

    // Días que lleva el partner sin contestarme (cuando me deben)
    const theirPendingDays = turn === 'theirs'
      ? DB.daysBetween(thread.myLastMessage)
      : null;

    // Estado de urgencia (solo cuando debo yo)
    let urgencyClass = '';
    if (turn === 'mine') {
      if (daysOwed >= thread.maxDays)          urgencyClass = 'urgency-overdue';
      else if (thread.maxDays - daysOwed <= 1) urgencyClass = 'urgency-warning';
    }

    // ── Etiquetas según turno ──────────────────────────────
    let metaHTML = '';

    if (turn === 'mine') {
      // Días que llevo sin contestar (desde su último mensaje)
      metaHTML += `<span class="days-badge ${urgencyClass}">${daysOwed}d sin contestar</span>`;
      // Días que tardó el partner la última vez en responderme
      if (thread.theirResponseDays !== null && thread.theirResponseDays !== undefined) {
        metaHTML += `<span class="days-response" title="Tardó ${thread.theirResponseDays}d en responderme">↩ ${thread.theirResponseDays}d</span>`;
      }
      // Límite de notificación
      metaHTML += `<span class="max-days" title="Límite: ${thread.maxDays} días">⏱ ${thread.maxDays}d</span>`;

    } else if (turn === 'theirs') {
      // Días que lleva el partner sin contestarme
      if (theirPendingDays !== null) {
        metaHTML += `<span class="days-response days-waiting">${theirPendingDays}d esperando</span>`;
      }
      // Días que tardé yo la última vez en responder
      if (thread.myResponseDays !== null && thread.myResponseDays !== undefined) {
        metaHTML += `<span class="days-response" title="Tardé ${thread.myResponseDays}d en responder">✍ ${thread.myResponseDays}d</span>`;
      }
      // Límite de notificación
      metaHTML += `<span class="max-days" title="Límite: ${thread.maxDays} días">⏱ ${thread.maxDays}d</span>`;

    } else {
      // Sin turno definido: solo el límite
      metaHTML += `<span class="max-days" title="Límite: ${thread.maxDays} días">⏱ ${thread.maxDays}d</span>`;
    }

    // Estrella de favorito
    const star = thread.favorite
      ? `<span class="fav-star fav-star--on" title="Favorito">★</span>`
      : `<span class="fav-star fav-star--off" title="No favorito">☆</span>`;

    return `
      <li class="thread-row ${turn === 'theirs' ? 'thread-row--dim' : ''} ${urgencyClass}">
        <div class="tr-left">
          <div class="tr-name-row">
            ${star}
            <span class="tr-partner">${thread.partnerName}</span>
          </div>
          <div class="tr-meta">${metaHTML}</div>
        </div>
        <div class="tr-actions">
          <button class="btn-icon btn-thread-dates" data-id="${thread.id}" title="Actualizar fechas">📅</button>
          <button class="btn-icon btn-thread-edit"  data-id="${thread.id}" title="Editar">✏️</button>
          <button class="btn-icon btn-thread-del"   data-id="${thread.id}" title="Borrar">🗑️</button>
        </div>
      </li>
    `;
  },

  /* ══════════════════════════════════════════════════════
     MODALES
  ══════════════════════════════════════════════════════ */

  /** Muestra un modal genérico. Retorna el elemento overlay. */
  _showModal(title, bodyHTML, onConfirm, confirmLabel = 'Guardar') {
    // Eliminar modal previo si existe
    document.getElementById('modal-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h3 class="modal-title">${title}</h3>
        <div class="modal-body">${bodyHTML}</div>
        <div class="modal-footer">
          <button class="btn-ghost" id="modal-cancel">Cancelar</button>
          <button class="btn-primary" id="modal-confirm">${confirmLabel}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Cerrar al pulsar fuera
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });
    document.getElementById('modal-cancel').addEventListener('click', () => overlay.remove());
    document.getElementById('modal-confirm').addEventListener('click', () => {
      onConfirm(overlay);
    });

    return overlay;
  },

  /** Modal: añadir personaje */
  showAddCharModal() {
    this._showModal(
      'Nuevo personaje',
      `<label>Nombre<input id="m-char-name" type="text" placeholder="Ej: Lucía Vega" /></label>
       <label>Juego / Fandom<input id="m-char-game" type="text" placeholder="Ej: Dragon Age" /></label>`,
      overlay => {
        const name = document.getElementById('m-char-name').value.trim();
        const game = document.getElementById('m-char-game').value.trim();
        if (!name) { alert('El nombre es obligatorio.'); return; }
        DB.addCharacter(name, game);
        overlay.remove();
        this.render();
      }
    );
    // Focus automático
    setTimeout(() => document.getElementById('m-char-name')?.focus(), 50);
  },

  /** Modal: editar personaje */
  _showEditCharModal(charId) {
    const char = DB.getCharacters().find(c => c.id === charId);
    if (!char) return;
    this._showModal(
      'Editar personaje',
      `<label>Nombre<input id="m-char-name" type="text" value="${char.name}" /></label>
       <label>Juego / Fandom<input id="m-char-game" type="text" value="${char.game}" /></label>`,
      overlay => {
        const name = document.getElementById('m-char-name').value.trim();
        const game = document.getElementById('m-char-game').value.trim();
        if (!name) { alert('El nombre es obligatorio.'); return; }
        DB.editCharacter(charId, name, game);
        overlay.remove();
        this.render();
      }
    );
  },

  /** Modal: añadir hilo */
  _showAddThreadModal(charId) {
    this._showModal(
      'Nuevo hilo',
      `<label>Nombre del partner<input id="m-th-partner" type="text" placeholder="Ej: Mireia (Rosamund)" /></label>
       <label>Días máximos para contestar
         <input id="m-th-maxdays" type="number" min="1" max="30" value="3" />
       </label>
       <label class="label-checkbox">
         <input id="m-th-fav" type="checkbox" />
         <span>⭐ Marcar como favorito</span>
       </label>`,
      overlay => {
        const partner = document.getElementById('m-th-partner').value.trim();
        const maxDays = document.getElementById('m-th-maxdays').value;
        const fav     = document.getElementById('m-th-fav').checked;
        if (!partner) { alert('El nombre del partner es obligatorio.'); return; }
        DB.addThread(charId, partner, maxDays, fav);
        overlay.remove();
        this.render();
      }
    );
    setTimeout(() => document.getElementById('m-th-partner')?.focus(), 50);
  },

  /** Modal: editar hilo */
  _showEditThreadModal(threadId) {
    const thread = DB.getThreads().find(t => t.id === threadId);
    if (!thread) return;
    this._showModal(
      'Editar hilo',
      `<label>Nombre del partner<input id="m-th-partner" type="text" value="${thread.partnerName}" /></label>
       <label>Días máximos para contestar
         <input id="m-th-maxdays" type="number" min="1" max="30" value="${thread.maxDays}" />
       </label>
       <label class="label-checkbox">
         <input id="m-th-fav" type="checkbox" ${thread.favorite ? 'checked' : ''} />
         <span>⭐ Marcar como favorito</span>
       </label>`,
      overlay => {
        const partner = document.getElementById('m-th-partner').value.trim();
        const maxDays = document.getElementById('m-th-maxdays').value;
        const fav     = document.getElementById('m-th-fav').checked;
        if (!partner) { alert('El nombre del partner es obligatorio.'); return; }
        DB.editThread(threadId, partner, maxDays, fav);
        overlay.remove();
        this.render();
      }
    );
  },

  /**
   * Modal: actualizar fechas de un hilo.
   * El selector de turno solo aparece si las dos fechas son el mismo día.
   * Cuando las fechas son distintas, el turno se calcula automáticamente.
   */
  _showDatesModal(threadId) {
    const thread = DB.getThreads().find(t => t.id === threadId);
    if (!thread) return;
    const today = DB.today();

    // Turno guardado explícitamente (para preseleccionar si coinciden fechas)
    const savedTurn = thread.lastTurn || null;

    // Detectamos si las fechas actuales ya coinciden (para mostrar el selector de entrada)
    const datesMatch = thread.myLastMessage &&
                       thread.theirLastMessage &&
                       thread.myLastMessage === thread.theirLastMessage;

    // El selector se muestra si las fechas ya coinciden al abrir;
    // también se muestra dinámicamente al cambiar las fechas (ver JS abajo)
    const turnSelectorHTML = `
      <div class="turn-selector" id="turn-selector" style="display:${datesMatch ? 'flex' : 'none'}">
        <span class="turn-label">¿Quién escribió último?</span>
        <div class="turn-options">
          <label class="turn-option">
            <input type="radio" name="last-turn" value="theirs"
              ${savedTurn === 'theirs' || (!savedTurn && datesMatch) ? 'checked' : ''} />
            <span>${thread.partnerName}</span>
          </label>
          <label class="turn-option">
            <input type="radio" name="last-turn" value="mine"
              ${savedTurn === 'mine' ? 'checked' : ''} />
            <span>Yo</span>
          </label>
        </div>
      </div>
    `;

    this._showModal(
      `Fechas — ${thread.partnerName}`,
      `
      <label>Mi último mensaje
        <div class="date-row">
          <input id="m-my-date" type="date" value="${thread.myLastMessage || ''}" max="${today}" />
          <button class="btn-ghost btn-today" data-target="m-my-date">Hoy</button>
        </div>
      </label>
      <label>Su último mensaje
        <div class="date-row">
          <input id="m-their-date" type="date" value="${thread.theirLastMessage || ''}" max="${today}" />
          <button class="btn-ghost btn-today" data-target="m-their-date">Hoy</button>
        </div>
      </label>
      ${turnSelectorHTML}
      <p class="modal-hint">
        💡 Si ambas fechas son el mismo día, indica quién escribió último.
      </p>
      `,
      overlay => {
        const myDate   = document.getElementById('m-my-date').value    || null;
        const theirDate = document.getElementById('m-their-date').value || null;
        // Si las fechas coinciden, recogemos el turno elegido; si no, lo dejamos null
        // para que getTurn lo calcule automáticamente por fechas
        const coinciden = myDate && theirDate && myDate === theirDate;
        const lastTurn  = coinciden
          ? (document.querySelector('input[name="last-turn"]:checked')?.value || null)
          : null;
        DB.updateThreadDates(threadId, myDate, theirDate, lastTurn);
        overlay.remove();
        this.render();
      }
    );

    // Botones "Hoy" y lógica para mostrar/ocultar el selector de turno
    setTimeout(() => {
      const myInput    = document.getElementById('m-my-date');
      const theirInput = document.getElementById('m-their-date');
      const selector   = document.getElementById('turn-selector');

      // Mostrar u ocultar el selector según si las fechas coinciden
      const toggleSelector = () => {
        const match = myInput.value && theirInput.value && myInput.value === theirInput.value;
        selector.style.display = match ? 'flex' : 'none';
      };

      myInput.addEventListener('change', toggleSelector);
      theirInput.addEventListener('change', toggleSelector);

      document.querySelectorAll('.btn-today').forEach(btn => {
        btn.addEventListener('click', () => {
          document.getElementById(btn.dataset.target).value = today;
          toggleSelector();
        });
      });
    }, 50);
  },

  /** Confirmación simple de borrado */
  _confirmDelete(message, onConfirm) {
    this._showModal(
      'Confirmar borrado',
      `<p class="modal-confirm-msg">${message}</p>`,
      overlay => { onConfirm(); overlay.remove(); },
      'Borrar'
    );
  }

};

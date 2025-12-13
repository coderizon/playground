import { sessionStore, DATASET_STATUS } from '../../store/sessionStore.js';

export function renderClassList(container, classes = []) {
  if (!container) return;
  if (!classes.length) {
    container.innerHTML = emptyStateTemplate();
    return;
  }

  container.innerHTML = '';
  classes.forEach((classState, index) => {
    container.appendChild(buildClassCard(classState, index));
  });
}

function buildClassCard(classState, index) {
  const card = document.createElement('article');
  card.className = 'class-card-v2';
  card.dataset.classId = classState.id;
  card.innerHTML = `
    <header>
      <input
        type="text"
        class="class-name-input"
        value="${escapeHtml(classState.name || `Klasse ${index + 1}`)}"
        maxlength="60"
        aria-label="Klassenname eingeben"
      />
      <span class="dataset-chip dataset-chip--${classState.dataset.status}">
        ${formatDatasetStatus(classState.dataset.status)}
      </span>
    </header>
    <p class="dataset-summary">
      ${classState.dataset.recordedCount}/${classState.dataset.expectedCount} Beispiele
    </p>
    <div class="class-card-actions">
      <button type="button" class="ghost" disabled>Recorder öffnen</button>
      <button type="button" class="ghost" data-delete>Entfernen</button>
    </div>
  `;

  const nameInput = card.querySelector('.class-name-input');
  nameInput?.addEventListener('change', () => {
    sessionStore.setClassName(classState.id, nameInput.value);
  });

  const deleteBtn = card.querySelector('[data-delete]');
  deleteBtn?.addEventListener('click', () => {
    const confirmDelete = window.confirm(
      `Klasse "${classState.name}" löschen? Gesammelte Daten für diese Klasse gehen verloren.`
    );
    if (confirmDelete) {
      sessionStore.removeClass(classState.id);
    }
  });

  return card;
}

function emptyStateTemplate() {
  return `
    <div class="collect-empty">
      <h3>Noch keine Klassen</h3>
      <p>Füge mindestens zwei Klassen hinzu, benenne sie und sammle Beispiele.</p>
    </div>
  `;
}

function formatDatasetStatus(status) {
  switch (status) {
    case DATASET_STATUS.READY:
      return 'Bereit';
    case DATASET_STATUS.RECORDING:
      return 'Aufnahme läuft';
    case DATASET_STATUS.ERROR:
      return 'Fehler';
    default:
      return 'Leer';
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

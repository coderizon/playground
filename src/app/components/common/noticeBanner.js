export function renderNoticeBanner(container, { tone = 'info', title, message } = {}) {
  if (!container) return;
  container.innerHTML = `
    <div class="notice notice--${tone}">
      <div class="notice-body">
        <strong>${title ?? ''}</strong>
        <p>${message ?? ''}</p>
      </div>
    </div>
  `;
}

export function renderNoticeBanner(
  container,
  { tone = 'info', title, message, assertive = false } = {}
) {
  if (!container) return;
  const liveAttr = assertive ? 'assertive' : 'polite';
  container.innerHTML = `
    <div
      class="notice notice--${tone}"
      role="status"
      aria-live="${liveAttr}"
      aria-atomic="true"
    >
      <div class="notice-body">
        <strong>${title ?? ''}</strong>
        <p>${message ?? ''}</p>
      </div>
    </div>
  `;
}

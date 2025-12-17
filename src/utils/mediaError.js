const MEDIA_ERROR_TRANSLATIONS = [
  {
    pattern: /device\s+is\s+already\s+in\s+use/i,
    text: 'Gerät wird bereits verwendet.',
  },
  {
    pattern: /device\s+in\s+use/i,
    text: 'Gerät wird bereits verwendet.',
  },
];

export function translateMediaErrorMessage(message) {
  if (!message) return '';
  const trimmed = message.trim();
  if (!trimmed) return '';
  const match = MEDIA_ERROR_TRANSLATIONS.find(({ pattern }) => pattern.test(trimmed));
  return match ? match.text : '';
}

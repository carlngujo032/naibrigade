// Each troop keeps one color everywhere. Colors read well on both the dark board and white cards.
const TROOP_COLORS = {
  Asia: '#e5483b',
  Africa: '#f5b82e',
  Australia: '#2fb7a4',
  Europe: '#3b9af0',
  'North America': '#9b7bf0',
  'South America': '#7fbf3f',
};
const FALLBACKS = ['#2fb7a4', '#f08a3b', '#7fbf3f', '#c46bd6', '#4b6cf0'];

export const troopColor = (name, id = 0) => TROOP_COLORS[name] ?? FALLBACKS[id % FALLBACKS.length];

const MINUS = '\u2212';
export const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `${MINUS}${Math.abs(n)}` : '0');
export const plain = (n) => (n < 0 ? `${MINUS}${Math.abs(n)}` : String(n));

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
export function timeAgo(value, now = Date.now()) {
  const seconds = Math.round((new Date(value).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 10) return 'just now';
  if (abs < 60) return rtf.format(seconds, 'second');
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
  return rtf.format(Math.round(seconds / 86400), 'day');
}

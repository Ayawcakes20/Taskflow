export function percent(value, total) { return total ? Math.round((value / total) * 100) : 0; }
export function humanize(value = '') { return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }

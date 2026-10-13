// Match the existing backend rules without exposing implementation details in UI copy.
export function newPasswordError(password) {
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Use at least 8 characters with a letter and a number.';
  if (new TextEncoder().encode(password).length > 72) return 'This password is too long. Try a shorter password.';
  return '';
}

export function passwordStrength(password) {
  if (!password) return { score: 0, label: 'Use a letter and a number' };
  if (newPasswordError(password)) return { score: 0, label: 'Check the requirements' };
  const score = 1 + Number(password.length >= 12) + Number(password.length >= 16 || /[^A-Za-z0-9]/.test(password));
  return { score, label: ['Valid password', 'Good password', 'Strong password'][score - 1] };
}

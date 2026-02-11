export const ADMIN_PASSWORD = 'admin2026';
export const ADMIN_SESSION_KEY = 'scheduleAdminUnlocked';

export const isAdminSessionUnlocked = (): boolean => {
  return localStorage.getItem(ADMIN_SESSION_KEY) === 'true';
};

export const setAdminSessionUnlocked = (value: boolean): void => {
  localStorage.setItem(ADMIN_SESSION_KEY, String(value));
};

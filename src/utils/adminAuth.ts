import { dataService } from '../services/dataService';

export const SELECTED_ADMIN_KEY = 'scheduleSelectedAdminId';
export const ADMIN_SESSION_KEY = 'scheduleAdminSessionId';

export const getSelectedAdminId = (): string => {
  return localStorage.getItem(SELECTED_ADMIN_KEY) ?? dataService.SUPER_ADMIN_ID;
};

export const setSelectedAdminId = (adminId: string): void => {
  localStorage.setItem(SELECTED_ADMIN_KEY, adminId);
};

export const getAdminSessionId = (): string | null => localStorage.getItem(ADMIN_SESSION_KEY);

export const setAdminSessionId = (adminId: string | null): void => {
  if (!adminId) {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    return;
  }
  localStorage.setItem(ADMIN_SESSION_KEY, adminId);
};

export const clearAdminSession = (): void => {
  localStorage.removeItem(ADMIN_SESSION_KEY);
};

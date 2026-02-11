import type { SpecialValue } from '../types';

export const STORAGE_KEY = 'scheduleAppData';

export const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const SPECIAL_LABELS: Record<SpecialValue, string> = {
  OFF: 'В',
  VACATION: 'О',
  SICK: 'Б',
  STUDY: 'У'
};

export const SPECIAL_OPTIONS: Array<{ value: SpecialValue; label: string; description: string }> = [
  { value: 'OFF', label: 'В', description: 'Выходной' },
  { value: 'VACATION', label: 'О', description: 'Отпуск' },
  { value: 'SICK', label: 'Б', description: 'Больничный' },
  { value: 'STUDY', label: 'У', description: 'Учеба' }
];

export const MONTHS_2026 = Array.from({ length: 12 }, (_, idx) => idx + 1);

export type MonthStatus = 'draft' | 'published';
export type EntryKind = 'OBJECT' | 'SPECIAL';
export type SpecialValue = 'OFF' | 'VACATION' | 'SICK' | 'STUDY';

export interface AdminUser {
  id: string;
  name: string;
  password: string;
  is_super: boolean;
}

export interface Employee {
  id: string;
  admin_id: string;
  full_name: string;
  active: boolean;
  token: string;
}

export interface WorkObject {
  id: string;
  admin_id: string;
  name_ru: string;
  short_ru: string;
  active: boolean;
}

export interface ScheduleEntry {
  kind: EntryKind;
  object_id?: string;
  special?: SpecialValue;
}

export interface MonthData {
  status: MonthStatus;
  entries: Record<string, ScheduleEntry>;
}

export interface AppData {
  admins: AdminUser[];
  employees: Employee[];
  objects: WorkObject[];
  months: Record<string, MonthData>;
}

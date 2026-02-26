export type MonthStatus = 'draft' | 'published';
export type EntryKind = 'OBJECT' | 'SPECIAL';
export type SpecialValue = 'OFF' | 'VACATION' | 'SICK' | 'STUDY';
export type EmployeeRole = 'mechanic' | 'trainee';

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
  role: EmployeeRole;
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
  vacation_requests: VacationRequest[];
}

export interface VacationRequest {
  id: string;
  admin_id: string;
  employee_id: string;
  month_key: string;
  start_date: string;
  end_date: string;
  vacation_days: number;
  created_at: string;
  updated_at: string;
  created_by: 'employee' | 'admin';
}

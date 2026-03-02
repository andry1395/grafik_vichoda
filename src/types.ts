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
  plans: Record<string, PlanMetrics>;
  vacation_requests: VacationRequest[];
}

export interface PlanMetrics {
  month_key: string;
  object_id: string;
  car_entries_plan: number | null;
  car_entries_fact: number | null;
  average_check_plan: number | null;
  average_check_fact: number | null;
  air_filter_ratio_plan: number | null;
  air_filter_ratio_fact: number | null;
  cabin_filter_ratio_plan: number | null;
  cabin_filter_ratio_fact: number | null;
  flush_usage_ratio_plan: number | null;
  flush_usage_ratio_fact: number | null;
  akpp_ratio_plan: number | null;
  akpp_ratio_fact: number | null;
  partial_replacement_ratio_plan: number | null;
  partial_replacement_ratio_fact: number | null;
  technical_fluids_ratio_plan: number | null;
  technical_fluids_ratio_fact: number | null;
  additional_services_ratio_plan: number | null;
  additional_services_ratio_fact: number | null;
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

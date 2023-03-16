import { z } from "zod";

const CompaniesEmployeeSerializerSchema = z.object({
  id: z.number().int(),
  num: z.string().nullable(),
  display_name: z.string(),
  entry_date: z.string(),
  retire_date: z.string().nullable(),
  user_id: z.number().int().nullable(),
  email: z.string().nullable(),
  payroll_calculation: z.boolean(),
});

const HolidaysAndHoursSerializer = z.object({ days: z.number(), hours: z.number().int() });

const EmployeesWorkRecordTimeRangeSerializerSchema = z.object({
  clock_in_at: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}(:[0-9]{2})?$/),
  clock_out_at: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}(:[0-9]{2})?$/),
});

const EmployeesEmployeeMultiHourlyWageWorkRecordSummarySerializerSchema = z.object({
  name: z.string(),
  total_normal_time_mins: z.number().int(),
});

const EmployeesWorkRecordTimeRangeResponseSerializerSchema = z.object({
  clock_in_at: z.string(),
  clock_out_at: z.string(),
});

const EmployeesWorkRecordSerializerSchema = z.object({
  break_records: z.array(EmployeesWorkRecordTimeRangeResponseSerializerSchema),
  clock_in_at: z.string().nullable(),
  clock_out_at: z.string().nullable(),
  date: z.string(),
  day_pattern: z.enum(["normal_day", "prescribed_holiday", "legal_holiday"]),
  schedule_pattern: z.enum([
    "",
    "substitute_holiday_work",
    "substitute_holiday",
    "compensatory_holiday_work",
    "compensatory_holiday",
    "special_holiday",
  ]),
  early_leaving_mins: z.number().int(),
  hourly_paid_holiday_mins: z.number().int(),
  is_absence: z.boolean(),
  is_editable: z.boolean(),
  lateness_mins: z.number().int(),
  normal_work_clock_in_at: z.string().nullable(),
  normal_work_clock_out_at: z.string().nullable(),
  normal_work_mins: z.number().int(),
  normal_work_mins_by_paid_holiday: z.number().int(),
  note: z.string().max(255),
  paid_holiday: z.number(),
  use_attendance_deduction: z.boolean(),
  use_default_work_pattern: z.boolean(),
  total_overtime_work_mins: z.number().int(),
  total_holiday_work_mins: z.number().int(),
  total_latenight_work_mins: z.number().int(),
  not_auto_calc_work_time: z.boolean(),
  total_excess_statutory_work_mins: z.number().int(),
  total_latenight_excess_statutory_work_mins: z.number().int(),
  total_overtime_except_normal_work_mins: z.number().int(),
  total_latenight_overtime_except_normal_work_min: z.number().int(),
});

const EmployeesWorkRecordSummarySerializerSchema = z.object({
  year: z.number().int(),
  month: z.number().int().gte(1).lte(12),
  start_date: z.string(),
  end_date: z.string(),
  work_days: z.number(),
  total_work_mins: z.number().int(),
  total_normal_work_mins: z.number().int(),
  total_excess_statutory_work_mins: z.number().int(),
  total_overtime_except_normal_work_mins: z.number().int(),
  total_overtime_within_normal_work_mins: z.number().int(),
  total_holiday_work_mins: z.number().int(),
  total_latenight_work_mins: z.number().int(),
  num_absences: z.number(),
  num_paid_holidays: z.number(),
  num_paid_holidays_and_hours: HolidaysAndHoursSerializer,
  num_paid_holidays_left: z.number(),
  num_paid_holidays_and_hours_left: HolidaysAndHoursSerializer,
  num_substitute_holidays_used: z.number(),
  num_compensatory_holidays_used: z.number(),
  num_special_holidays_used: z.number(),
  num_special_holidays_and_hours_used: HolidaysAndHoursSerializer,
  total_lateness_and_early_leaving_mins: z.number().int(),
  multi_hourly_wages: z.array(EmployeesEmployeeMultiHourlyWageWorkRecordSummarySerializerSchema),
  work_records: z.array(EmployeesWorkRecordSerializerSchema),
  total_shortage_work_mins: z.number().int().nullable(),
  total_deemed_paid_excess_statutory_work_mins: z.number().int().nullable(),
  total_deemed_paid_overtime_except_normal_work_mins: z.number().int().nullable(),
});

const EmployeesTimeClocksControllerSchema_create_body = z.object({
  company_id: z.number().int().gte(1).lte(2147483647),
  type: z.enum(["clock_in", "break_begin", "break_end", "clock_out"]),
  base_date: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
    .optional(),
  datetime: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}(:[0-9]{2})?$/)
    .optional(),
});

const EmployeesWorkRecordsControllerSchema_update_body = z.object({
  company_id: z.number().int().gte(1).lte(2147483647),
  break_records: z.array(EmployeesWorkRecordTimeRangeSerializerSchema).optional(),
  clock_in_at: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}(:[0-9]{2})?$/)
    .optional(),
  clock_out_at: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}(:[0-9]{2})?$/)
    .optional(),
  day_pattern: z.enum(["normal_day", "prescribed_holiday", "legal_holiday"]).optional(),
  early_leaving_mins: z.number().int().lte(1440).optional(),
  is_absence: z.boolean().optional(),
  lateness_mins: z.number().int().lte(1440).optional(),
  normal_work_clock_in_at: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}(:[0-9]{2})?$/)
    .optional(),
  normal_work_clock_out_at: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}(:[0-9]{2})?$/)
    .optional(),
  normal_work_mins: z.number().int().lte(1440).optional(),
  normal_work_mins_by_paid_holiday: z.number().int().lte(1440).optional(),
  note: z.string().max(255).optional(),
  paid_holiday: z.number().lte(1).optional(),
  use_attendance_deduction: z.boolean().optional(),
  use_default_work_pattern: z.boolean().optional(),
});

export const schemas = {
  CompaniesEmployeeSerializerSchema,
  EmployeesWorkRecordSerializerSchema,
  EmployeesWorkRecordSummarySerializerSchema,
};

export type EmployeesWorkRecordSerializer = z.infer<typeof EmployeesWorkRecordSerializerSchema>;
export type CompaniesEmployeeSerializer = z.infer<typeof CompaniesEmployeeSerializerSchema>;
export type EmployeesTimeClocksController_create_body = z.infer<typeof EmployeesTimeClocksControllerSchema_create_body>;
export type EmployeesWorkRecordsController_update_body = z.infer<
  typeof EmployeesWorkRecordsControllerSchema_update_body
>;

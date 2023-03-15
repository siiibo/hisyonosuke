import { z } from "zod";
import { ok, err, Result } from "neverthrow";
import { getService } from "./auth";
import { buildUrl } from "./utilities";

const CompaniesEmployeeSerializerSchema = z.object({
  id: z.number().int(),
  num: z.string().nullable(),
  display_name: z.string(),
  entry_date: z.string(), //datetime
  retire_date: z.string().nullable(), //datetime
  user_id: z.number().int().nullable(),
  email: z.string().nullable(),
  payroll_calculation: z.boolean(),
});
type CompaniesEmployeeSerializer = z.infer<typeof CompaniesEmployeeSerializerSchema>;

export interface WorkRecordTimeRangeResponseSerializer {
  clock_in_at: string; // DATETIME
  clock_out_at: string; // DATETIME
}

export interface EmployeeMultiHourlyWageWorkRecordSummarySerializer {
  name: string;
  total_normal_time_mins: number;
}

export interface HolidaysAndHoursSerializer {
  days: number;
  hours: number;
}

export interface TimeClocksControllerCreateBody {
  company_id: number;
  type: "clock_in" | "break_begin" | "break_end" | "clock_out";
  base_date: string; // YYYY-MM-DD
  datetime: string; // YYYY-MM-DD HH:MM:SS
}

// https://developer.freee.co.jp/docs/hr/reference#/%E5%8B%A4%E6%80%A0/update_employee_work_record
// 登録済みの勤怠時間の変更・勤務パターンの変更など、要求によってrequiredが変わるため、nullable typeは厳密ではない
export interface WorkRecordControllerRequestBody {
  company_id: number;
  break_records?: WorkRecordTimeRangeResponseSerializer[];
  clock_in_at?: string; //DATETIME
  clock_out_at?: string; //DATETIME
  day_pattern?: string;
  early_leaving_mins?: number;
  is_absence?: boolean;
  lateness_mins?: number;
  normal_work_clock_in_at?: string; //DATETIME
  normal_work_clock_out_at?: string; //DATETIME
  normal_work_mins?: number;
  normal_work_mins_by_paid_holiday?: number;
  note?: string;
  paid_holiday?: number;
  use_attendance_deduction?: boolean;
  use_default_work_pattern?: boolean;
}

export interface WorkRecordSummarySerializer {
  year: number;
  month: number;
  start_date: string; // DateString,
  end_date: string; // DateString,
  work_days: number;
  total_work_mins: number;
  total_normal_work_mins: number;
  total_excess_statutory_work_mins: number;
  total_overtime_except_normal_work_mins: number;
  total_overtime_within_normal_work_mins: number;
  total_holiday_work_mins: number;
  total_latenight_work_mins: number;
  num_absences: number;
  num_paid_holidays: number;
  num_paid_holidays_and_hours: HolidaysAndHoursSerializer;
  num_paid_holidays_left: number;
  num_paid_holidays_and_hours_left: HolidaysAndHoursSerializer;
  num_substitute_holidays_used: number;
  num_compensatory_holidays_used: number;
  num_special_holidays_used: number;
  num_special_holidays_and_hours_used: HolidaysAndHoursSerializer;
  total_lateness_and_early_leaving_mins: number;
  multi_hourly_wages: EmployeeMultiHourlyWageWorkRecordSummarySerializer[];
  work_records: WorkRecordSerializer[];
}

export interface WorkRecordSerializer {
  break_records: WorkRecordTimeRangeResponseSerializer[];
  clock_in_at: number;
  clock_out_at: number;
  date: string; // DateString,
  day_pattern: "normal_day" | "prescribed_holiday" | "legal_holiday";
  schedule_pattern:
    | "substitute_holiday_work"
    | "substitute_holiday"
    | "compensatory_holiday_work"
    | "compensatory_holiday"
    | "special_holiday";
  early_leaving_mins: number;
  hourly_paid_holiday_mins: number;
  is_absence: boolean;
  is_editable: boolean;
  lateness_mins: number;
  normal_work_clock_in_at: string; // DateString,
  normal_work_clock_out_at: string; // DateString,
  normal_work_mins: number;
  normal_work_mins_by_paid_holiday: number;
  note: string;
  paid_holiday: number;
  use_attendance_deduction: boolean;
  use_default_work_pattern: boolean;
  total_overtime_work_mins: number;
  total_holiday_work_mins: number;
  total_latenight_work_mins: number;
}

const fetch = createFetch(getService().getAccessToken());

function createFetch(accessToken: string) {
  return <T>(
    url: string,
    options: {
      method: "get" | "post" | "put" | "delete";
      body?: unknown;
    }
  ): Result<T, string> => {
    const response = UrlFetchApp.fetch(url, {
      headers: {
        Authorization: "Bearer " + accessToken,
        "FREEE-VERSION": "2022-02-01",
      },
      method: options.method,
      muteHttpExceptions: true,
      ...(["post", "put"].includes(options.method) && {
        payload: JSON.stringify(options.body),
        contentType: "application/json",
      }),
    });
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();
    const isSuccess = responseCode === 200 || responseCode === 201;
    return isSuccess ? ok(JSON.parse(responseBody)) : err(responseBody);
  };
}

export function setTimeClocks(employId: number, body: TimeClocksControllerCreateBody) {
  const accessToken = getService().getAccessToken();
  const requestUrl = `https://api.freee.co.jp/hr/api/v1/employees/${employId}/time_clocks`;
  const payload = {
    ...body,
  };

  const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "post",
    headers: {
      Authorization: "Bearer " + accessToken,
      "FREEE-VERSION": "2022-02-01",
    },
    contentType: "application/json",
    payload: JSON.stringify(payload),
  };
  const response = UrlFetchApp.fetch(requestUrl, params).getContentText();
  return JSON.parse(response);
}

export function getWorkRecordSummary(
  companyId: number,
  employId: number,
  year: number,
  month: number,
  workRecords = false
): WorkRecordSummarySerializer {
  const accessToken = getService().getAccessToken();
  const requestUrl = buildUrl(
    `https://api.freee.co.jp/hr/api/v1/employees/${employId}/work_record_summaries/${year}/${month}`,
    {
      company_id: companyId,
      work_records: workRecords ? "true" : "false",
    }
  );
  const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "get",
    headers: {
      Authorization: "Bearer " + accessToken,
      "FREEE-VERSION": "2022-02-01",
    },
    contentType: "application/json",
  };
  const response = UrlFetchApp.fetch(requestUrl, params).getContentText();
  return JSON.parse(response);
}


export function getWorkRecord(employId: number, date: string, company_id: number): WorkRecordSerializer {
  const accessToken = getService().getAccessToken();
  const requestUrl = buildUrl(`https://api.freee.co.jp/hr/api/v1/employees/${employId}/work_records/${date}`, {
    company_id,
  });
  const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "get",
    headers: {
      Authorization: "Bearer " + accessToken,
      "FREEE-VERSION": "2022-02-01",
    },
  };
  const response = UrlFetchApp.fetch(requestUrl, params).getContentText();
  return JSON.parse(response);
}

export function getCompanyEmployees(props: {
  company_id: number;
  limit?: number; // 1~100, default:50
  offset?: number; // pagination
}): CompaniesEmployeeSerializer[] {
  const accessToken = getService().getAccessToken();
  // emailを取得したいので"/api/v1/employees"ではなくこちらを使っている
  // TODO: このエンドポイントはページネーションが不可能なため、100人を超える場合は↑のエントポイントと組み合わせる必要がある？
  const requestUrl = buildUrl(`https://api.freee.co.jp/hr/api/v1/companies/${props.company_id}/employees`, props);
  const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "get",
    headers: {
      Authorization: "Bearer " + accessToken,
      "FREEE-VERSION": "2022-02-01",
    },
    contentType: "application/json",
  };
  const response = JSON.parse(UrlFetchApp.fetch(requestUrl, params).getContentText());
  return CompaniesEmployeeSerializerSchema.array().parse(response);
}

export function updateWorkRecord(employId: number, date: string, body: WorkRecordControllerRequestBody) {
  const accessToken = getService().getAccessToken();
  const requestUrl = `https://api.freee.co.jp/hr/api/v1/employees/${employId}/work_records/${date}`;
  const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "put",
    headers: {
      Authorization: "Bearer " + accessToken,
      "FREEE-VERSION": "2022-02-01",
    },
    contentType: "application/json",
    payload: JSON.stringify(body),
  };
  const response = UrlFetchApp.fetch(requestUrl, params).getContentText();
  return JSON.parse(response);
}

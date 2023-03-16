import { ok, err, Result } from "neverthrow";
import { schemas } from "./freee.schema";
import type {
  CompaniesEmployeeSerializer,
  EmployeesWorkRecordSerializer,
  EmployeesWorkRecordsController_update_body,
  EmployeesTimeClocksController_create_body,
} from "./freee.schema";
import { getService } from "./auth";
import { buildUrl } from "./utilities";

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

export function setTimeClocks(employId: number, body: EmployeesTimeClocksController_create_body) {
  const requestUrl = `https://api.freee.co.jp/hr/api/v1/employees/${employId}/time_clocks`;
  return fetch(requestUrl, { method: "post", body });
}

export function getWorkRecord(employId: number, date: string, company_id: number) {
  const requestUrl = buildUrl(`https://api.freee.co.jp/hr/api/v1/employees/${employId}/work_records/${date}`, {
    company_id,
  });
  return fetch<EmployeesWorkRecordSerializer>(requestUrl, { method: "get" });
}

export function getCompanyEmployees(props: {
  company_id: number;
  limit?: number; // 1~100, default:50
  offset?: number; // pagination
}) {
  // emailを取得したいので"/api/v1/employees"ではなくこちらを使っている
  // TODO: このエンドポイントはページネーションが不可能なため、100人を超える場合は↑のエントポイントと組み合わせる必要がある？
  const requestUrl = buildUrl(`https://api.freee.co.jp/hr/api/v1/companies/${props.company_id}/employees`, props);
  return fetch<CompaniesEmployeeSerializer[]>(requestUrl, { method: "get" });
}

export function updateWorkRecord(employId: number, date: string, body: EmployeesWorkRecordsController_update_body) {
  const requestUrl = `https://api.freee.co.jp/hr/api/v1/employees/${employId}/work_records/${date}`;
  return fetch(requestUrl, { method: "put", body });
}

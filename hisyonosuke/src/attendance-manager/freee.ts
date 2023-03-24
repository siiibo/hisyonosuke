import { z } from "zod";
import { ok, err, Result } from "neverthrow";
import { EmployeesWorkRecordTimeRangeSerializer, schemas } from "./freee.schema";
import type {
  EmployeesWorkRecordsController_update_body,
  EmployeesTimeClocksController_create_body,
} from "./freee.schema";
import { getService } from "./auth";
import { buildUrl } from "./utilities";

// ローカルテスト時にはPropertiesServiceが存在しないため、ダミーのfetch関数を作成する
const fetch =
  typeof PropertiesService === "undefined" ? createFetch("dummy") : createFetch(getService().getAccessToken());

function createFetch(accessToken: string) {
  return <Schema>(
    url: string,
    options: {
      method: "get" | "post" | "put" | "delete";
      body?: unknown;
      schema?: z.ZodType<Schema>;
    }
  ): Result<Schema, string> => {
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

    const { schema } = options;
    if (schema) {
      const parseResult = schema.safeParse(JSON.parse(responseBody));
      const parsed = parseResult.success ? ok(parseResult.data) : err(parseResult.error.message);
      return isSuccess ? parsed : err(responseBody);
    } else {
      return isSuccess ? ok(JSON.parse(responseBody)) : err(responseBody);
    }
  };
}

export function setTimeClocks(employId: number, body: EmployeesTimeClocksController_create_body) {
  const requestUrl = `https://api.freee.co.jp/hr/api/v1/employees/${employId}/time_clocks`;
  return fetch(requestUrl, {
    method: "post",
    body,
    schema: schemas.EmployeesTimeClocksController_create_response,
  });
}

export function getWorkRecord(employId: number, date: string, company_id: number) {
  const requestUrl = buildUrl(`https://api.freee.co.jp/hr/api/v1/employees/${employId}/work_records/${date}`, {
    company_id,
  });
  return fetch(requestUrl, { method: "get", schema: schemas.EmployeesWorkRecordSerializerSchema });
}

export function getCompanyEmployees(props: {
  company_id: number;
  limit?: number; // 1~100, default:50
  offset?: number; // pagination
}) {
  // emailを取得したいので"/api/v1/employees"ではなくこちらを使っている
  // TODO: このエンドポイントはページネーションが不可能なため、100人を超える場合は↑のエントポイントと組み合わせる必要がある？
  const requestUrl = buildUrl(`https://api.freee.co.jp/hr/api/v1/companies/${props.company_id}/employees`, props);
  return fetch(requestUrl, { method: "get", schema: schemas.CompaniesEmployeeSerializerSchema.array() });
}

export function updateWorkRecord(employId: number, date: string, body: EmployeesWorkRecordsController_update_body) {
  const requestUrl = `https://api.freee.co.jp/hr/api/v1/employees/${employId}/work_records/${date}`;
  return fetch(requestUrl, { method: "put", body, schema: schemas.EmployeesWorkRecordSerializerSchema });
}

export function getTotalTimeFromTimeRanges(timeRanges: EmployeesWorkRecordTimeRangeSerializer[]) {
  const sum = timeRanges.reduce((prev, current) => {
    const start = new Date(current.clock_in_at);
    const end = new Date(current.clock_out_at);
    const diff = end.getTime() - start.getTime();
    return prev + diff;
  }, 0);
  return sum;
}

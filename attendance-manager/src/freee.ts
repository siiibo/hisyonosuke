import { format } from "date-fns";
import { type Result, err, ok } from "neverthrow";
import { match } from "ts-pattern";
import type { z } from "zod";
import { getService } from "./auth";
import { schemas } from "./freee.schema";
import type {
  EmployeesTimeClocksController_create_body,
  EmployeesWorkRecordsController_update_body,
} from "./freee.schema";
import { buildUrl } from "./utilities";

export class Freee {
  private fetch;

  constructor() {
    this.fetch = this.createFetch(getService().getAccessToken());
  }

  private createFetch(accessToken: string) {
    return <Schema>(
      url: string,
      options: {
        method: "get" | "post" | "put" | "delete";
        body?: unknown;
        schema?: z.ZodType<Schema>;
      },
    ): Result<Schema, string> => {
      const wrappedFetch = () => {
        const response = UrlFetchApp.fetch(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
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

        return match(responseCode)
          .with(200, 201, () => {
            if (!options.schema) return ok(JSON.parse(responseBody));
            const parseResult = options.schema.safeParse(JSON.parse(responseBody));
            return parseResult.success ? ok(parseResult.data) : err(parseResult.error.message);
          })
          .with(500, () => {
            return err("Error: Internal Server Error");
          })
          .otherwise(() => err(responseBody));
      };
      return withRetry(
        {
          times: 3,
          delay: 1000,
          backoff: (count) => count * 1000,
          shouldRetry: (error) => error === "Error: Internal Server Error",
        },
        wrappedFetch,
      );
    };
  }

  public setTimeClocks(employId: number, body: EmployeesTimeClocksController_create_body) {
    const requestUrl = `https://api.freee.co.jp/hr/api/v1/employees/${employId}/time_clocks`;
    return this.fetch(requestUrl, {
      method: "post",
      body,
      schema: schemas.EmployeesTimeClocksController_create_response,
    });
  }

  public getWorkRecord(employId: number, date: string, company_id: number) {
    const requestUrl = buildUrl(`https://api.freee.co.jp/hr/api/v1/employees/${employId}/work_records/${date}`, {
      company_id,
    });
    return this.fetch(requestUrl, { method: "get", schema: schemas.EmployeesWorkRecordSerializerSchema });
  }

  public getCompanyEmployees(props: {
    company_id: number;
    limit?: number; // 1~100, default:50
    offset?: number; // pagination
  }) {
    // emailを取得したいので"/api/v1/employees"ではなくこちらを使っている
    // TODO: このエンドポイントはページネーションが不可能なため、100人を超える場合は↑のエントポイントと組み合わせる必要がある？
    const requestUrl = buildUrl(`https://api.freee.co.jp/hr/api/v1/companies/${props.company_id}/employees`, props);
    return this.fetch(requestUrl, { method: "get", schema: schemas.CompaniesEmployeeSerializerSchema.array() });
  }

  public updateWorkRecord(employId: number, date: string, body: EmployeesWorkRecordsController_update_body) {
    const requestUrl = `https://api.freee.co.jp/hr/api/v1/employees/${employId}/work_records/${date}`;
    return this.fetch(requestUrl, { method: "put", body, schema: schemas.EmployeesWorkRecordSerializerSchema });
  }
}

function withRetry<TReturn>(
  options: {
    times?: number;
    delay?: number;
    backoff?: (count: number) => number;
    shouldRetry?: (error: string) => boolean;
  },
  func: () => Result<TReturn, string>,
): Result<TReturn, string> {
  const times = options.times ?? 3;
  const delay = options.delay;
  const backoff = options.backoff;
  const shouldRetry = options.shouldRetry ?? (() => true);

  for (let i = 1; i <= times; i++) {
    const result = func();
    if (result.isOk()) return result;
    if (i === times || !shouldRetry(result.error)) return result;

    console.warn(`Retry ${i} time(s) with error: ${result.error}\nfunc: ${func.name}`);
    if (delay) Utilities.sleep(delay);
    if (backoff) Utilities.sleep(backoff(i));
  }
  return err("Error: Unreachable code path");
}

export function formatDate(date: Date | string, type: "date" | "timeConcise" | "datetime") {
  // NOTE: freee APIのresponseでは「yyyy-MM-ddTHH:mm:ss.SSSZ」の形式で返ってくるが、requestでは「yyyy-MM-dd HH:mm:ss」の形式にする必要がある
  const formatString = match(type)
    .with("date", () => "yyyy-MM-dd")
    .with("datetime", () => "yyyy-MM-dd HH:mm")
    .with("timeConcise", () => "HH:mm")
    .exhaustive();
  const _format = (_date: Date) => format(_date, formatString);
  return typeof date === "string" ? _format(new Date(date)) : _format(date);
}

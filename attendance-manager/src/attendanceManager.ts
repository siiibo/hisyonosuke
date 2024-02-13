import { GasWebClient as SlackClient } from "@hi-se/web-api";
import { subDays, toDate, set } from "date-fns";
import { formatDate, Freee } from "./freee";
import type { EmployeesWorkRecordsController_update_body } from "./freee.schema";
import { getConfig } from "./config";
import { REACTION } from "./reaction";
import { Message, getCategorizedDailyMessages } from "./message";
import { getCommandType } from "./command";
import { getUpdatedUserWorkStatus, getUserWorkStatusesByMessages, UserWorkStatus } from "./userWorkStatus";
import { ActionType, getActionType } from "./action";
import { Result, err, ok } from "neverthrow";
import { match, P } from "ts-pattern";
import { getUnixTimeStampString } from "./utilities";

const DATE_START_HOUR = 4;

export function initAttendanceManager() {
  const targetFunction = periodicallyCheckForAttendanceManager;

  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === targetFunction.name) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger(targetFunction.name).timeBased().everyMinutes(5).create();
}

export function periodicallyCheckForAttendanceManager() {
  const client = getSlackClient();

  const { CHANNEL_IDS, BOT_USER_ID } = getConfig();

  // チャンネルごとに関数自体を分けて別プロセス（別のタイムトリガー）で動かすように変更する可能性あり
  CHANNEL_IDS.forEach((channelId) => {
    checkAttendance(client, channelId, BOT_USER_ID);
  });
}

export function initAutoClockOut() {
  const targetFunction = manageForgottenClockOut;
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === targetFunction.name) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger(targetFunction.name).timeBased().atHour(DATE_START_HOUR).nearMinute(15).everyDays(1).create();
}

export function manageForgottenClockOut() {
  const client = getSlackClient();

  const { CHANNEL_IDS, BOT_USER_ID } = getConfig();

  // チャンネルごとに関数自体を分けて別プロセス（別のタイムトリガー）で動かすように変更する可能性あり
  CHANNEL_IDS.forEach((channelId) => {
    autoCheckAndClockOut(client, channelId, BOT_USER_ID);
  });
}
/*
  NOTE:
  dateStartHour ~ 現在時刻までのメッセージから勤怠情報を取得→freeeへの登録を行う。
  triggerの呼び出し毎に、処理済みのメッセージも含めてチェックするという冗長な処理になってしまっている。
  いずれPropServiceなどを使って状態管理するほうが良いかもしれない。
 */
function checkAttendance(client: SlackClient, channelId: string, botUserId: string) {
  const { FREEE_COMPANY_ID } = getConfig();
  const today = new Date();
  const { processedMessages, unprocessedMessages } = getCategorizedDailyMessages(
    client,
    channelId,
    botUserId,
    DATE_START_HOUR,
    today,
  );
  if (!unprocessedMessages.length && !processedMessages.length) return;

  const userWorkStatuses = getUserWorkStatusesByMessages(processedMessages);

  unprocessedMessages.forEach((message) => {
    const commandType = getCommandType(message);
    if (!commandType) {
      return;
    }
    const userWorkStatus = userWorkStatuses[message.user];
    getActionType(commandType, userWorkStatus)
      .andThen((actionType) => {
        return execAction(client, new Freee(), channelId, FREEE_COMPANY_ID, {
          message,
          userWorkStatus,
          actionType,
        });
      })
      .match(
        (data) => {
          userWorkStatuses[message.user] = getUpdatedUserWorkStatus(userWorkStatus, commandType);
          console.info(JSON.stringify({ userWorkStatus, ...data }, null, 2));
        },
        (error) => {
          console.error(JSON.stringify({ userWorkStatus, ...error }, null, 2));
          client.chat.postMessage({ channel: channelId, text: error.message, thread_ts: message.ts });
          client.reactions.add({ channel: channelId, name: REACTION.ERROR, timestamp: message.ts });
        },
      );
  });
}

function autoCheckAndClockOut(client: SlackClient, channelId: string, botUserId: string) {
  const today = new Date();
  const yesterday = subDays(new Date(), 1);

  const { processedMessages, unprocessedMessages } = getCategorizedDailyMessages(
    client,
    channelId,
    botUserId,
    DATE_START_HOUR,
    yesterday,
  );
  if (!unprocessedMessages.length && !processedMessages.length) return;
  const userWorkStatuses = getUserWorkStatusesByMessages(processedMessages);
  const freee = new Freee();
  const { FREEE_COMPANY_ID } = getConfig();
  const unClockedOutSlackIds = Object.keys(userWorkStatuses).filter((slackId) => {
    const userStatus = userWorkStatuses[slackId];
    return userStatus !== undefined && userStatus.workStatus !== "退勤済み";
  });
  if (unClockedOutSlackIds.length === 0) return;
  Result.combineWithAllErrors(
    unClockedOutSlackIds.map((slackId) => {
      return getFreeeEmployeeIdFromSlackUserId(client, freee, slackId, FREEE_COMPANY_ID)
        .andThen((employeeId) => {
          const userStatus = userWorkStatuses[slackId];
          const clockOutParams = {
            company_id: FREEE_COMPANY_ID,
            type: "clock_out" as const,
            base_date: formatDate(yesterday, "date"),
            datetime: formatDate(today, "datetime"),
          };
          freee.setTimeClocks(employeeId, clockOutParams).andThen(() => {
            if (userStatus?.workStatus === "勤務中（リモート）") {
              freee.getWorkRecord(employeeId, formatDate(yesterday, "date"), FREEE_COMPANY_ID).andThen((workRecord) => {
                if (workRecord.clock_in_at === null || workRecord.clock_out_at === null) {
                  return err(`出勤時間が不正な値です`);
                }
                const newWorkRecord: EmployeesWorkRecordsController_update_body = {
                  company_id: FREEE_COMPANY_ID,
                  clock_in_at: formatDate(workRecord.clock_in_at, "datetime"),
                  clock_out_at: formatDate(workRecord.clock_out_at, "datetime"),
                  note: workRecord.note ? `${workRecord.note} リモート` : "リモート",
                  break_records: workRecord.break_records.map((record) => {
                    return {
                      clock_in_at: formatDate(record.clock_in_at, "datetime"),
                      clock_out_at: formatDate(record.clock_out_at, "datetime"),
                    };
                  }),
                };
                return freee
                  .updateWorkRecord(employeeId, formatDate(yesterday, "date"), newWorkRecord)
                  .andThen(() => ok(slackId));
              });
            }
            return ok(slackId);
          });
          return ok(slackId);
        })
        .orElse((e) => err({ message: e, slackId }));
    }),
  ).match(
    (slackIds) => {
      const mentionIds = slackIds.map((slackId) => `<@${slackId}>`).join(", ");
      const message = `${mentionIds}\n前日に未退勤だったため自動退勤を行いました。freeeにログインして修正してください。`;
      const timeToPost = set(new Date(), { hours: 9, minutes: 0, seconds: 0 });
      const response = client.chat.scheduleMessage({
        channel: channelId,
        text: message,
        post_at: getUnixTimeStampString(timeToPost),
      });
      if (!response.ok) {
        throw new Error(response.error);
      }
    },
    (errors) => {
      console.error(JSON.stringify(errors, null, 2));
    },
  );
}

function execAction(
  client: SlackClient,
  freee: Freee,
  channelId: string,
  freeCompanyId: number,
  action: {
    message: Message;
    actionType: ActionType;
    userWorkStatus: UserWorkStatus | undefined;
  },
) {
  const { message, actionType } = action;
  return getFreeeEmployeeIdFromSlackUserId(client, freee, message.user, freeCompanyId)
    .orElse((e) => err({ message: e }))
    .andThen((employeeId) => {
      const result = match(actionType)
        .with("clock_in", () => handleClockIn(client, freee, channelId, freeCompanyId, employeeId, message))
        .with("switch_work_status_to_office", () => handleSwitchWorkStatusToOffice(client, channelId, message))
        .with("switch_work_status_to_remote", () => handleSwitchWorkStatusToRemote(client, channelId, message))
        .with("clock_out", () => handleClockOut(client, freee, channelId, freeCompanyId, employeeId, message))
        .with("clock_out_and_add_remote_memo", () =>
          handleClockOutAndAddRemoteMemo(client, freee, channelId, freeCompanyId, employeeId, message),
        )
        .exhaustive();
      return result
        .andThen((r) => ok({ result: r, employeeId, actionType }))
        .orElse((error) => err({ message: error, employeeId, actionType }));
    });
}

function handleClockIn(
  client: SlackClient,
  freee: Freee,
  channelId: string,
  FREEE_COMPANY_ID: number,
  employeeId: number,
  message: Message,
) {
  const clockInDate = message.date;

  const clockInParams = {
    company_id: FREEE_COMPANY_ID,
    type: "clock_in" as const,
    base_date: formatDate(clockInDate, "date"),
    datetime: formatDate(clockInDate, "datetime"),
  };

  return freee
    .setTimeClocks(employeeId, clockInParams)
    .andThen(() => {
      client.reactions.add({ channel: channelId, name: REACTION.DONE_FOR_TIME_RECORD, timestamp: message.ts });
      return ok("ok");
    })
    .orElse((e) => {
      return match(e)
        .with(
          P.when((e) => e.includes("打刻の種類が正しくありません。")),
          () => err("既に打刻済みです"),
        )
        .with(
          P.when((e) => e.includes("打刻の日付が不正な値です。")),
          () => err("前日の退勤を完了してから出勤打刻してください."),
        )
        .otherwise(() => err(e));
    });
}

function handleSwitchWorkStatusToOffice(client: SlackClient, channelId: string, message: Message) {
  client.reactions.add({ channel: channelId, name: REACTION.DONE_FOR_LOCATION_SWITCH, timestamp: message.ts });
  return ok("ok");
}

function handleSwitchWorkStatusToRemote(client: SlackClient, channelId: string, message: Message) {
  client.reactions.add({ channel: channelId, name: REACTION.DONE_FOR_LOCATION_SWITCH, timestamp: message.ts });
  return ok("ok");
}

function handleClockOut(
  client: SlackClient,
  freee: Freee,
  channelId: string,
  FREEE_COMPANY_ID: number,
  employeeId: number,
  message: Message,
) {
  const clockOutDate = message.date;
  const clockOutBaseDate = getBaseDate(message.date);

  const clockOutParams = {
    company_id: FREEE_COMPANY_ID,
    type: "clock_out" as const,
    base_date: formatDate(clockOutBaseDate, "date"),
    datetime: formatDate(clockOutDate, "datetime"),
  };

  return freee
    .setTimeClocks(employeeId, clockOutParams)
    .andThen(() => {
      client.reactions.add({ channel: channelId, name: REACTION.DONE_FOR_TIME_RECORD, timestamp: message.ts });
      return ok("ok");
    })
    .orElse((e) => {
      return match(e)
        .with(
          P.when((e) => e.includes("打刻の種類が正しくありません。")),
          () => err("出勤打刻が完了していないか、退勤の上書きができない値です."),
        )
        .otherwise(() => err(e));
    });
}

function handleClockOutAndAddRemoteMemo(
  client: SlackClient,
  freee: Freee,
  channelId: string,
  FREEE_COMPANY_ID: number,
  employeeId: number,
  message: Message,
) {
  const targetDate = formatDate(getBaseDate(message.date), "date");

  return handleClockOut(client, freee, channelId, FREEE_COMPANY_ID, employeeId, message)
    .andThen(() => {
      return freee.getWorkRecord(employeeId, targetDate, FREEE_COMPANY_ID);
    })
    .andThen((workRecord) => {
      if (workRecord.clock_in_at === null || workRecord.clock_out_at === null) {
        return err(`出勤時間か退勤時間が不正な値です.`);
      }
      const newWorkRecord: EmployeesWorkRecordsController_update_body = {
        company_id: FREEE_COMPANY_ID,
        clock_in_at: formatDate(workRecord.clock_in_at, "datetime"),
        clock_out_at: formatDate(workRecord.clock_out_at, "datetime"),
        note: workRecord.note ? `${workRecord.note} リモート` : "リモート",
        break_records: workRecord.break_records.map((record) => {
          return {
            clock_in_at: formatDate(record.clock_in_at, "datetime"),
            clock_out_at: formatDate(record.clock_out_at, "datetime"),
          };
        }),
      };
      return freee.updateWorkRecord(employeeId, targetDate, newWorkRecord);
    })
    .andThen(() => {
      client.reactions.add({ channel: channelId, name: REACTION.DONE_FOR_REMOTE_MEMO, timestamp: message.ts });
      return ok("ok");
    });
}

function getBaseDate(date: Date) {
  return date.getHours() > DATE_START_HOUR ? toDate(date) : subDays(date, 1);
}

function getFreeeEmployeeIdFromSlackUserId(client: SlackClient, freee: Freee, slackUserId: string, companyId: number) {
  // TODO: PropertiesService等を挟むようにする（毎回APIを投げない）
  const email = client.users.info({ user: slackUserId }).user?.profile?.email;
  if (!email) return err("email is undefined.");

  return freee.getCompanyEmployees({ company_id: companyId, limit: 100 }).andThen((employees) => {
    const target = employees.find((employee) => employee.email === email);
    return target ? ok(target.id) : err("target is undefined.");
  });
}

function getSlackClient() {
  const token = PropertiesService.getScriptProperties().getProperty("SLACK_TOKEN");
  if (!token) {
    throw Error("SLACK_TOKEN is undefined.");
  }
  return new SlackClient(token);
}

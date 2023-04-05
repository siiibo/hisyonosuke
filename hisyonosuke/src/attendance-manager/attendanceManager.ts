import { GasWebClient as SlackClient } from "@hi-se/web-api";
import { format, subDays, toDate } from "date-fns";
import { formatDate, getCompanyEmployees, getWorkRecord, setTimeClocks, updateWorkRecord } from "./freee";
import type { EmployeesWorkRecordsController_update_body } from "./freee.schema";
import { getConfig } from "./config";
import { REACTION } from "./reaction";
import { Message, getCategorizedDailyMessages } from "./message";
import { getCommandType } from "./command";
import { getUpdatedUserWorkStatus, getUserWorkStatusesByMessages, UserWorkStatus } from "./userWorkStatus";
import { ActionType, getActionType } from "./action";
import { err, ok } from "neverthrow";
import { match, P } from "ts-pattern";
import { calculateBreakTimeMsToAdd, createAdditionalBreakTime } from "./breackRecord";

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

/*
  NOTE:
  dateStartHour ~ 現在時刻までのメッセージから勤怠情報を取得→freeeへの登録を行う。
  triggerの呼び出し毎に、処理済みのメッセージも含めてチェックするという冗長な処理になってしまっている。
  いずれPropServiceなどを使って状態管理するほうが良いかもしれない。
 */
function checkAttendance(client: SlackClient, channelId: string, botUserId: string) {
  const { FREEE_COMPANY_ID } = getConfig();

  const { processedMessages, unprocessedMessages } = getCategorizedDailyMessages(
    client,
    channelId,
    botUserId,
    DATE_START_HOUR
  );
  if (!unprocessedMessages.length && !processedMessages.length) return;

  const userWorkStatuses = getUserWorkStatusesByMessages(processedMessages);

  unprocessedMessages.forEach((message) => {
    const commandType = getCommandType(message);
    if (!commandType) {
      return;
    }
    const userWorkStatus = userWorkStatuses[message.user];
    const actionType = getActionType(commandType, userWorkStatus);
    execAction(client, channelId, FREEE_COMPANY_ID, {
      message,
      userWorkStatus,
      actionType,
    });
    userWorkStatuses[message.user] = getUpdatedUserWorkStatus(userWorkStatus, commandType);
  });
}

function execAction(
  client: SlackClient,
  channelId: string,
  freeCompanyId: number,
  action: {
    message: Message;
    actionType: ActionType;
    userWorkStatus: UserWorkStatus | undefined;
  }
) {
  const { message, actionType, userWorkStatus } = action;
  return getFreeeEmployeeIdFromSlackUserId(client, message.user, freeCompanyId)
    .orElse((e) => err({ message: e }))
    .andThen((employeeId) => {
      const result = match(actionType)
        .with("clock_in", () => handleClockIn(client, channelId, freeCompanyId, employeeId, message))
        .with("switch_work_status_to_office", () => handleSwitchWorkStatusToOffice(client, channelId, message))
        .with("switch_work_status_to_remote", () => handleSwitchWorkStatusToRemote(client, channelId, message))
        .with("clock_out", () => handleClockOut(client, channelId, freeCompanyId, employeeId, message))
        .with("clock_out_and_add_remote_memo", () =>
          handleClockOutAndAddRemoteMemo(client, channelId, freeCompanyId, employeeId, message)
        )
        .with("break_begin", () => handleBreakBegin(client, channelId, freeCompanyId, employeeId, message))
        .with("break_end", () => handleBreakEnd(client, channelId, freeCompanyId, employeeId, message))
        .exhaustive();
      return result
        .andThen((r) => ok({ result: r, employeeId }))
        .orElse((error) => err({ message: error, employeeId }));
    })
    .match(
      (data) => {
        console.info(JSON.stringify({ actionType, userWorkStatus, ...data }, null, 2));
      },
      (error) => {
        console.error(JSON.stringify({ actionType, userWorkStatus, ...error }, null, 2));
        client.chat.postMessage({ channel: channelId, text: error.message, thread_ts: message.ts });
        client.reactions.add({ channel: channelId, name: REACTION.ERROR, timestamp: message.ts });
      }
    );
}

function handleClockIn(
  client: SlackClient,
  channelId: string,
  FREEE_COMPANY_ID: number,
  employeeId: number,
  message: Message
) {
  const clockInDate = message.date;

  const clockInParams = {
    company_id: FREEE_COMPANY_ID,
    type: "clock_in" as const,
    base_date: format(clockInDate, "yyyy-MM-dd"),
    datetime: format(clockInDate, "yyyy-MM-dd HH:mm:ss"),
  };

  return setTimeClocks(employeeId, clockInParams)
    .andThen(() => {
      client.reactions.add({ channel: channelId, name: REACTION.DONE_FOR_TIME_RECORD, timestamp: message.ts });
      return ok("ok");
    })
    .orElse((e) => {
      return match(e)
        .with(
          P.when((e) => e.includes("打刻の種類が正しくありません。")),
          () => err("既に打刻済みです")
        )
        .with(
          P.when((e) => e.includes("打刻の日付が不正な値です。")),
          () => err("前日の退勤を完了してから出勤打刻してください.")
        )
        .otherwise(() => err(e));
    });
}

function handleBreakBegin(
  client: SlackClient,
  channelId: string,
  FREEE_COMPANY_ID: number,
  employeeId: number,
  message: Message
) {
  const breakBeginDate = message.date;
  return setTimeClocks(employeeId, {
    company_id: FREEE_COMPANY_ID,
    type: "break_begin",
    base_date: formatDate(breakBeginDate, "date"),
    datetime: formatDate(breakBeginDate, "datetime"),
  })
    .andThen(() => {
      client.reactions.add({ channel: channelId, name: REACTION.DONE_FOR_TIME_RECORD, timestamp: message.ts });
      return ok("ok");
    })
    .orElse((e) => {
      return err(e);
    });
}

function handleBreakEnd(
  client: SlackClient,
  channelId: string,
  FREEE_COMPANY_ID: number,
  employeeId: number,
  message: Message
) {
  const breakEndDate = message.date;

  return setTimeClocks(employeeId, {
    company_id: FREEE_COMPANY_ID,
    type: "break_end",
    base_date: formatDate(breakEndDate, "datetime"),
    datetime: formatDate(breakEndDate, "datetime"),
  })
    .andThen(() => {
      client.reactions.add({ channel: channelId, name: REACTION.DONE_FOR_TIME_RECORD, timestamp: message.ts });
      return ok("ok");
    })
    .orElse((e) => {
      return err(e);
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
  channelId: string,
  FREEE_COMPANY_ID: number,
  employeeId: number,
  message: Message
) {
  const clockOutDate = message.date;
  const clockOutBaseDate = getBaseDate(message.date);

  const clockOutParams = {
    company_id: FREEE_COMPANY_ID,
    type: "clock_out" as const,
    base_date: format(clockOutBaseDate, "yyyy-MM-dd"),
    datetime: format(clockOutDate, "yyyy-MM-dd HH:mm:ss"),
  };

  return setTimeClocks(employeeId, clockOutParams)
    .orElse((e) => {
      return match(e)
        .with(
          P.when((e) => e.includes("打刻の種類が正しくありません。")),
          () => err("出勤打刻が完了していないか、退勤の上書きができない値です.")
        )
        .otherwise(() => err(e));
    })
    .andThen(() => {
      return getWorkRecord(employeeId, format(clockOutDate, "yyyy-MM-dd"), FREEE_COMPANY_ID);
    })
    .andThen((workRecord) => {
      if (workRecord.clock_in_at === null || workRecord.clock_out_at === null) {
        return err(`出勤時間か退勤時間が不正な値です.`);
      }

      const timeRecord = {
        clock_in_at: workRecord.clock_in_at,
        clock_out_at: workRecord.clock_out_at,
        break_records: workRecord.break_records,
      };

      const breakTimeMsToAdd = calculateBreakTimeMsToAdd(timeRecord);
      console.log(timeRecord, breakTimeMsToAdd);
      if (breakTimeMsToAdd === 0) {
        return ok("ok");
      }
      const additionalBreakTime = createAdditionalBreakTime(timeRecord, breakTimeMsToAdd);
      const newNote = `自動追加(休憩: ${formatDate(additionalBreakTime.clock_in_at, "timeConcise")} - ${formatDate(
        additionalBreakTime.clock_out_at,
        "timeConcise"
      )})`;

      const newWorkRecord: EmployeesWorkRecordsController_update_body = {
        company_id: FREEE_COMPANY_ID,
        clock_in_at: formatDate(workRecord.clock_in_at, "datetime"),
        clock_out_at: formatDate(workRecord.clock_out_at, "datetime"),
        note: workRecord.note ? `${workRecord.note} ${newNote}` : newNote,
        break_records: [
          ...workRecord.break_records.map((record) => {
            return {
              clock_in_at: formatDate(record.clock_in_at, "datetime"),
              clock_out_at: formatDate(record.clock_out_at, "datetime"),
            };
          }),
          additionalBreakTime,
        ],
      };
      return updateWorkRecord(employeeId, formatDate(clockOutBaseDate, "date"), newWorkRecord);
    })
    .andThen(() => {
      client.reactions.add({ channel: channelId, name: REACTION.DONE_FOR_TIME_RECORD, timestamp: message.ts });
      return ok("ok");
    });
}

function handleClockOutAndAddRemoteMemo(
  client: SlackClient,
  channelId: string,
  FREEE_COMPANY_ID: number,
  employeeId: number,
  message: Message
) {
  const targetDate = formatDate(getBaseDate(message.date), "date");

  return handleClockOut(client, channelId, FREEE_COMPANY_ID, employeeId, message)
    .andThen(() => {
      return getWorkRecord(employeeId, targetDate, FREEE_COMPANY_ID);
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
      return updateWorkRecord(employeeId, targetDate, newWorkRecord);
    })
    .andThen(() => {
      client.reactions.add({ channel: channelId, name: REACTION.DONE_FOR_REMOTE_MEMO, timestamp: message.ts });
      return ok("ok");
    });
}

function getBaseDate(date: Date) {
  return date.getHours() > DATE_START_HOUR ? toDate(date) : subDays(date, 1);
}

function getFreeeEmployeeIdFromSlackUserId(client: SlackClient, slackUserId: string, companyId: number) {
  // TODO: PropertiesService等を挟むようにする（毎回APIを投げない）
  const email = client.users.info({ user: slackUserId }).user?.profile?.email;
  if (!email) return err("email is undefined.");

  return getCompanyEmployees({ company_id: companyId, limit: 100 }).andThen((employees) => {
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

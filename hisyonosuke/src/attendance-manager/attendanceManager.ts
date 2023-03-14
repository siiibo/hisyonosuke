import { GasWebClient as SlackClient } from "@hi-se/web-api";
import { format, subDays } from "date-fns";
import {
  getCompanyEmployees,
  getWorkRecord,
  setTimeClocks,
  updateWorkRecord,
  WorkRecordControllerRequestBody,
} from "./freee";
import { getConfig, initConfig } from "./config";
import { REACTION } from "./reaction";
import { Message, getDailyMessages, getUnprocessedMessages } from "./message";
import { getCommandType } from "./command";
import { getUpdatedUserWorkStatus, getUserWorkStatusesByMessages, UserWorkStatus } from "./workStatus";
import { ActionType, getActionType } from "./action";

const DATE_START_HOUR = 4;

export function initAttendanceManager() {
  initConfig();

  const targetFunction = periodicallyCheckForAttendanceManager;

  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === targetFunction.name) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger(targetFunction.name)
    .timeBased()
    .everyMinutes(5) //TODO: 定数化
    .create();
}

export function periodicallyCheckForAttendanceManager() {
  const client = getSlackClient();

  const { ATTENDANCE_CHANNEL_ID, PART_TIMER_CHANNEL_ID } = getConfig();

  // チャンネルごとに関数自体を分けて別プロセス（別のタイムトリガー）で動かすように変更する可能性あり
  checkAttendance(client, ATTENDANCE_CHANNEL_ID);
  checkAttendance(client, PART_TIMER_CHANNEL_ID);
}

/*
  NOTE:
  dateStartHour ~ 現在時刻までのメッセージから勤怠情報を取得→freeeへの登録を行う。
  triggerの呼び出し毎に、処理済みのメッセージも含めてチェックするという冗長な処理になってしまっている。
  いずれPropServiceなどを使って状態管理するほうが良いかもしれない。
 */
function checkAttendance(client: SlackClient, channelId: string) {
  const hisyonosukeUserId = "U01AY3RHR42"; // ボットはbot_idとuser_idの2つのidを持ち、リアクションにはuser_idが使われる
  const { FREEE_COMPANY_ID } = getConfig();

  const messages = getDailyMessages(client, channelId, DATE_START_HOUR);
  if (!messages.length) {
    return;
  }

  const userWorkStatuses = getUserWorkStatusesByMessages(messages, hisyonosukeUserId);

  const unprocessedMessages = getUnprocessedMessages(messages, hisyonosukeUserId);
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
  FREEE_COMPANY_ID: number,
  action: {
    message: Message;
    actionType: ActionType;
    userWorkStatus: UserWorkStatus | undefined;
  }
) {
  const { message, actionType, userWorkStatus } = action;
  let employeeId: number;

  try {
    employeeId = getFreeeEmployeeIdFromSlackUserId(client, message.user, FREEE_COMPANY_ID);
  } catch (e: any) {
    console.error(e.stack);
    console.error(`slackUserId:${message.user}, type: getEmployeeId`);
    const errorFeedBackMessage = e.toString();
    client.chat.postMessage({
      channel: channelId,
      text: errorFeedBackMessage,
      thread_ts: message.ts,
    });
    client.reactions.add({
      channel: channelId,
      name: REACTION.ERROR,
      timestamp: message.ts,
    });
    return;
  }

  try {
    switch (actionType) {
      case "clock_in":
        handleClockIn(client, channelId, FREEE_COMPANY_ID, employeeId, message);
        break;
      case "switch_work_status_to_office":
        handleSwitchWorkStatusToOffice(client, channelId, message);
        break;
      case "switch_work_status_to_remote":
        handleSwitchWorkStatusToRemote(client, channelId, message);
        break;
      case "clock_out":
        handleClockOut(client, channelId, FREEE_COMPANY_ID, employeeId, message);
        break;
      case "clock_out_and_add_remote_memo":
        handleClockOutAndAddRemoteMemo(client, channelId, FREEE_COMPANY_ID, employeeId, message);
    }
    console.info(
      `user:${employeeId}, type:${actionType}, messageTs: ${message.ts}\n${JSON.stringify(userWorkStatus, null, 2)}`
    );
  } catch (e: any) {
    console.error(e.stack);
    console.error(
      `user:${employeeId}, type:${actionType}, messageTs: ${message.ts}\n${JSON.stringify(userWorkStatus, null, 2)}`
    );

    let errorFeedBackMessage = e.toString();
    if (actionType === "clock_in") {
      if (e.message.includes("打刻の日付が不正な値です。")) {
        errorFeedBackMessage = `前日の退勤を完了してから出勤打刻してください.`;
      }
      if (e.message.includes("打刻の種類が正しくありません。")) {
        errorFeedBackMessage = "既に打刻済みです";
      }
    }
    if (actionType === "clock_out" && e.message.includes("打刻の種類が正しくありません。")) {
      errorFeedBackMessage = "出勤打刻が完了していないか、退勤の上書きができない値です.";
    }

    client.chat.postMessage({
      channel: channelId,
      text: errorFeedBackMessage,
      thread_ts: message.ts,
    });
    client.reactions.add({
      channel: channelId,
      name: REACTION.ERROR,
      timestamp: message.ts,
    });
  }
}

function handleClockIn(
  client: SlackClient,
  channelId: string,
  FREEE_COMPANY_ID: number,
  employeeId: number,
  message: Message
) {
  const clockInDate = new Date(parseInt(message.ts) * 1000);
  const clockInBaseDate = new Date(clockInDate.getTime());

  const clockInParams = {
    company_id: FREEE_COMPANY_ID,
    type: "clock_in" as const,
    base_date: format(clockInBaseDate, "yyyy-MM-dd"),
    datetime: format(clockInDate, "yyyy-MM-dd HH:mm:ss"),
  };

  setTimeClocks(employeeId, clockInParams);
  client.reactions.add({
    channel: channelId,
    name: REACTION.DONE_FOR_TIME_RECORD,
    timestamp: message.ts,
  });
}

function handleSwitchWorkStatusToOffice(client: SlackClient, channelId: string, message: Message) {
  client.reactions.add({
    channel: channelId,
    name: REACTION.DONE_FOR_LOCATION_SWITCH,
    timestamp: message.ts,
  });
}

function handleSwitchWorkStatusToRemote(client: SlackClient, channelId: string, message: Message) {
  client.reactions.add({
    channel: channelId,
    name: REACTION.DONE_FOR_LOCATION_SWITCH,
    timestamp: message.ts,
  });
}

function handleClockOut(
  client: SlackClient,
  channelId: string,
  FREEE_COMPANY_ID: number,
  employeeId: number,
  message: Message
) {
  const clockOutDate = new Date(parseInt(message.ts) * 1000);
  const clockOutBaseDate =
    clockOutDate.getHours() > DATE_START_HOUR ? new Date(clockOutDate.getTime()) : subDays(clockOutDate, 1);

  const clockOutParams = {
    company_id: FREEE_COMPANY_ID,
    type: "clock_out" as const,
    base_date: format(clockOutBaseDate, "yyyy-MM-dd"),
    datetime: format(clockOutDate, "yyyy-MM-dd HH:mm:ss"),
  };

  setTimeClocks(employeeId, clockOutParams);
  client.reactions.add({
    channel: channelId,
    name: REACTION.DONE_FOR_TIME_RECORD,
    timestamp: message.ts,
  });
}

function handleClockOutAndAddRemoteMemo(
  client: SlackClient,
  channelId: string,
  FREEE_COMPANY_ID: number,
  employeeId: number,
  message: Message
) {
  handleClockOut(client, channelId, FREEE_COMPANY_ID, employeeId, message);
  const clockOutDate = new Date(parseInt(message.ts) * 1000);
  const clockOutBaseDate =
    clockOutDate.getHours() > DATE_START_HOUR ? new Date(clockOutDate.getTime()) : subDays(clockOutDate, 1);
  const targetDate = format(clockOutBaseDate, "yyyy-MM-dd");
  const workRecord = getWorkRecord(employeeId, targetDate, FREEE_COMPANY_ID);
  const remoteParams: WorkRecordControllerRequestBody = {
    company_id: FREEE_COMPANY_ID,
    clock_in_at: format(new Date(workRecord.clock_in_at), "yyyy-MM-dd HH:mm:ss"),
    clock_out_at: format(new Date(workRecord.clock_out_at), "yyyy-MM-dd HH:mm:ss"),
    note: workRecord.note ? `${workRecord.note} リモート` : "リモート",
    break_records: workRecord.break_records.map((record) => {
      return {
        clock_in_at: format(new Date(record.clock_in_at), "yyyy-MM-dd HH:mm:ss"),
        clock_out_at: format(new Date(record.clock_out_at), "yyyy-MM-dd HH:mm:ss"),
      };
    }),
  };
  updateWorkRecord(employeeId, targetDate, remoteParams);
  client.reactions.add({
    channel: channelId,
    name: REACTION.DONE_FOR_REMOTE_MEMO,
    timestamp: message.ts,
  });
}

function getFreeeEmployeeIdFromSlackUserId(client: SlackClient, slackUserId: string, companyId: number): number {
  // TODO: PropertiesService等を挟むようにする（毎回APIを投げない）
  const email = client.users.info({
    user: slackUserId,
  }).user?.profile?.email;
  if (!email) {
    throw new Error("email is undefined.");
  }
  const employees = getCompanyEmployees({
    company_id: companyId,
    limit: 100,
  });
  const target = employees.filter((employee) => {
    return employee.email === email;
  });
  if (target.length == 0) {
    throw new Error(`employee email ${email} was not found.`);
  }
  if (target.length > 1) {
    throw new Error(`employee email ${email} is duplicated.`);
  }
  return target[0].id;
}

function getSlackClient() {
  const token = PropertiesService.getScriptProperties().getProperty("SLACK_TOKEN");
  if (!token) {
    throw Error("SLACK_TOKEN is undefined.");
  }
  return new SlackClient(token);
}

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
import { Message } from "@hi-se/web-api/src/response/ConversationsHistoryResponse";
import { REACTION } from "./reaction";
import { getDailyMessages, getProcessedMessages, getUnprocessedMessages } from "./message";
import { CommandType, getCommandType } from "./command";

interface UserWorkStatus {
  workStatus: "勤務中（出社）" | "勤務中（リモート）" | "退勤済み"; // 未出勤は現状利用していない
  needTrafficExpense: boolean;
  processedCommands: CommandType[];
}
type ActionType =
  | "clock_in"
  | "clock_out"
  | "clock_out_and_add_remote_memo"
  | "switch_work_status_to_office"
  | "switch_work_status_to_remote";

const DATE_START_HOUR = 4;

export const initAttendanceManager = () => {
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
};

export const periodicallyCheckForAttendanceManager = () => {
  const client = getSlackClient();

  const { ATTENDANCE_CHANNEL_ID, PART_TIMER_CHANNEL_ID } = getConfig();

  // チャンネルごとに関数自体を分けて別プロセス（別のタイムトリガー）で動かすように変更する可能性あり
  checkAttendance(client, ATTENDANCE_CHANNEL_ID);
  checkAttendance(client, PART_TIMER_CHANNEL_ID);
};

/*
  NOTE:
  dateStartHour ~ 現在時刻までのメッセージから勤怠情報を取得→freeeへの登録を行う。
  triggerの呼び出し毎に、処理済みのメッセージも含めてチェックするという冗長な処理になってしまっている。
  いずれPropServiceなどを使って状態管理するほうが良いかもしれない。
 */
const checkAttendance = (client: SlackClient, channelId: string) => {
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
    if (!message.user) {
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
};

const execAction = (
  client: SlackClient,
  channelId: string,
  FREEE_COMPANY_ID: number,
  action: {
    message: Message;
    actionType: ActionType;
    userWorkStatus: UserWorkStatus | undefined;
  }
) => {
  const { message, actionType, userWorkStatus } = action;
  let employeeId: number;

  try {
    if (!message.user) {
      throw new Error("user is undefined.");
    }
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
};

const handleClockIn = (
  client: SlackClient,
  channelId: string,
  FREEE_COMPANY_ID: number,
  employeeId: number,
  message: Message
) => {
  if (!message.ts) {
    throw new Error("message.ts is undefined.");
  }
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
};

const handleSwitchWorkStatusToOffice = (client: SlackClient, channelId: string, message: Message) => {
  client.reactions.add({
    channel: channelId,
    name: REACTION.DONE_FOR_LOCATION_SWITCH,
    timestamp: message.ts,
  });
};

const handleSwitchWorkStatusToRemote = (client: SlackClient, channelId: string, message: Message) => {
  client.reactions.add({
    channel: channelId,
    name: REACTION.DONE_FOR_LOCATION_SWITCH,
    timestamp: message.ts,
  });
};

const handleClockOut = (
  client: SlackClient,
  channelId: string,
  FREEE_COMPANY_ID: number,
  employeeId: number,
  message: Message
) => {
  if (!message.ts) {
    throw new Error("message.ts is undefined.");
  }
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
};

const handleClockOutAndAddRemoteMemo = (
  client: SlackClient,
  channelId: string,
  FREEE_COMPANY_ID: number,
  employeeId: number,
  message: Message
) => {
  if (!message.ts) {
    throw new Error("message.ts is undefined.");
  }
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
};

const getUpdatedUserWorkStatus = (
  userWorkStatus: UserWorkStatus | undefined,
  newCommand: CommandType
): UserWorkStatus => {
  const userCommands = userWorkStatus ? [...userWorkStatus.processedCommands, newCommand] : [newCommand];
  const workStatus = getUserWorkStatusByCommands(userCommands);
  const needTrafficExpense = userWorkStatus?.needTrafficExpense
    ? userWorkStatus.needTrafficExpense
    : checkTrafficExpense(userCommands);

  return {
    needTrafficExpense,
    workStatus,
    processedCommands: userCommands,
  };
};

const getUserWorkStatusesByMessages = (
  messages: Message[],
  botUserId: string
): { [userSlackId: string]: UserWorkStatus | undefined } => {
  const processedMessages = getProcessedMessages(messages, botUserId);

  // TODO: ↓ 「今誰いる？」の機能に流用する
  const clockedInUserIds = Array.from(new Set(processedMessages.map((message) => message.user)));
  const clockedInUserWorkStatuses = clockedInUserIds.map((userSlackId) => {
    const userCommands = processedMessages
      .filter((message) => message.user === userSlackId)
      .map((message) => getCommandType(message))
      .filter((command): command is CommandType => command !== undefined);
    const workStatus = getUserWorkStatusByCommands(userCommands);
    const needTrafficExpense = checkTrafficExpense(userCommands);

    const userWorkStatus: UserWorkStatus = {
      workStatus,
      needTrafficExpense,
      processedCommands: userCommands,
    };

    return [userSlackId, userWorkStatus];
  });

  return Object.fromEntries(clockedInUserWorkStatuses);
};

const checkTrafficExpense = (userCommands: CommandType[]) => {
  // 「リモート出勤」よりあとに「出社」がなければ交通費はかからず、それ以外は必要
  return (
    userCommands.lastIndexOf("CLOCK_IN_AND_ALL_DAY_REMOTE_OR_SWITCH_TO_ALL_DAY_REMOTE") <=
    userCommands.lastIndexOf("CLOCK_IN_OR_SWITCH_TO_OFFICE")
  );
};

const getUserWorkStatusByCommands = (commands: CommandType[]): UserWorkStatus["workStatus"] => {
  const lastCommand = commands[commands.length - 1];
  // 最後のuserMessageからworkStatusを算出できるはず
  // 休憩を打刻できるように変更する場合は、休憩打刻を除いた最後のメッセージを確認
  // TODO: ↑の検証

  switch (lastCommand) {
    case "CLOCK_OUT":
      return "退勤済み";
    case "CLOCK_IN_AND_ALL_DAY_REMOTE_OR_SWITCH_TO_ALL_DAY_REMOTE":
      return "勤務中（リモート）";
    case "SWITCH_TO_REMOTE":
      return "勤務中（リモート）";
    case "CLOCK_IN":
      return "勤務中（出社）";
    case "CLOCK_IN_OR_SWITCH_TO_OFFICE":
      return "勤務中（出社）";
  }
};

const getActionType = (commandType: CommandType, userWorkStatus: UserWorkStatus | undefined): ActionType => {
  switch (commandType) {
    case "CLOCK_IN":
      return "clock_in";
    case "CLOCK_IN_AND_ALL_DAY_REMOTE_OR_SWITCH_TO_ALL_DAY_REMOTE":
      // TODO: 勤務中（リモート）だった場合
      return userWorkStatus?.workStatus === "勤務中（出社）" ? "switch_work_status_to_remote" : "clock_in";
    case "CLOCK_IN_OR_SWITCH_TO_OFFICE":
      // TODO: 勤務中（出社）だった場合
      return userWorkStatus?.workStatus === "勤務中（リモート）" ? "switch_work_status_to_office" : "clock_in";
    case "SWITCH_TO_REMOTE":
      return "switch_work_status_to_remote";
    case "CLOCK_OUT":
      //TODO: 打刻の重複の場合
      return userWorkStatus?.needTrafficExpense === false ? "clock_out_and_add_remote_memo" : "clock_out";
  }
};

const getFreeeEmployeeIdFromSlackUserId = (client: SlackClient, slackUserId: string, companyId: number): number => {
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
};

const getSlackClient = () => {
  const token = PropertiesService.getScriptProperties().getProperty("SLACK_TOKEN");
  if (!token) {
    throw Error("SLACK_TOKEN is undefined.");
  }
  return new SlackClient(token);
};

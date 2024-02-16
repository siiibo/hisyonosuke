import { match } from "ts-pattern";
import * as R from "remeda";
import { CommandType, getCommandType } from "./command";
import { ProcessedMessage } from "./message";
import { valueOf } from "./utilities";

// 未出勤は現状利用していない
export const WORK_STATUS = {
  WORKING_AT_OFFICE: "勤務中（出社）",
  WORKING_REMOTELY: "勤務中（リモート）",
  CLOCKED_OUT: "退勤済み",
} as const;

export type UserWorkStatus = {
  clockInTime?: Date;
  workStatus: valueOf<typeof WORK_STATUS>;
  needTrafficExpense: boolean;
  processedCommands: CommandType[];
};

export function getUpdatedUserWorkStatus(
  userWorkStatus: UserWorkStatus | undefined,
  newCommand: CommandType,
): UserWorkStatus {
  const userCommands = userWorkStatus ? [...userWorkStatus.processedCommands, newCommand] : [newCommand];
  const workStatus = getUserWorkStatusByCommands(userCommands);
  const needTrafficExpense = userWorkStatus?.needTrafficExpense
    ? userWorkStatus.needTrafficExpense
    : checkTrafficExpense(userCommands);
  const clockInTime = userWorkStatus?.clockInTime;
  return {
    clockInTime,
    needTrafficExpense,
    workStatus,
    processedCommands: userCommands,
  };
}
function getClockInTimeByUserSlackId(processedMessages: ProcessedMessage[], userSlackId: string): Date | undefined {
  const slackClockInResult = processedMessages.filter((message) => {
    const commandType = getCommandType(message);
    if (!commandType) return false;
    if (userSlackId === message.user && commandType === "CLOCK_IN") return true;
    return false;
  });
  return slackClockInResult.length ? slackClockInResult[0].date : undefined;
}

export function getUserWorkStatusesByMessages(processedMessages: ProcessedMessage[]): {
  [userSlackId: string]: UserWorkStatus | undefined;
} {
  // TODO: ↓ 「今誰いる？」の機能に流用する
  const clockedInUserIds = Array.from(new Set(processedMessages.map((message) => message.user)));
  const clockedInUserWorkStatuses = clockedInUserIds.map((userSlackId) => {
    const userCommands = processedMessages
      .filter((message) => message.user === userSlackId)
      .map((message) => getCommandType(message))
      .filter((command): command is CommandType => command !== undefined);
    const workStatus = getUserWorkStatusByCommands(userCommands);
    const needTrafficExpense = checkTrafficExpense(userCommands);
    const clockInTime = getClockInTimeByUserSlackId(processedMessages, userSlackId);
    const userWorkStatus: UserWorkStatus = {
      clockInTime,
      workStatus,
      needTrafficExpense,
      processedCommands: userCommands,
    };

    return [userSlackId, userWorkStatus];
  });

  return Object.fromEntries(clockedInUserWorkStatuses);
}

export function getUserWorkStatusByCommands(commands: CommandType[]): UserWorkStatus["workStatus"] {
  const lastCommand = R.last(commands);
  const status = match(lastCommand)
    .with("CLOCK_IN", () => WORK_STATUS.WORKING_AT_OFFICE)
    .with("CLOCK_IN_OR_SWITCH_TO_OFFICE", () => WORK_STATUS.WORKING_AT_OFFICE)
    .with("CLOCK_IN_AND_ALL_DAY_REMOTE_OR_SWITCH_TO_ALL_DAY_REMOTE", () => WORK_STATUS.WORKING_REMOTELY)
    .with("SWITCH_TO_REMOTE", () => WORK_STATUS.WORKING_REMOTELY)
    .with("CLOCK_OUT", () => WORK_STATUS.CLOCKED_OUT)
    .otherwise(() => {
      throw new Error(`Unexpected command: ${lastCommand}`);
    });
  return status;
}

function checkTrafficExpense(userCommands: CommandType[]) {
  // 「リモート出勤」よりあとに「出社」がなければ交通費はかからず、それ以外は必要
  return (
    userCommands.lastIndexOf("CLOCK_IN_AND_ALL_DAY_REMOTE_OR_SWITCH_TO_ALL_DAY_REMOTE") <=
    userCommands.lastIndexOf("CLOCK_IN_OR_SWITCH_TO_OFFICE")
  );
}

import { CommandType, getCommandType } from "./command";
import { Message, getProcessedMessages } from "./message";

export type UserWorkStatus = {
  workStatus: "勤務中（出社）" | "勤務中（リモート）" | "退勤済み"; // 未出勤は現状利用していない
  needTrafficExpense: boolean;
  processedCommands: CommandType[];
};

export function getUpdatedUserWorkStatus(
  userWorkStatus: UserWorkStatus | undefined,
  newCommand: CommandType
): UserWorkStatus {
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
}

export function getUserWorkStatusesByMessages(
  messages: Message[],
  botUserId: string
): { [userSlackId: string]: UserWorkStatus | undefined } {
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
}

function getUserWorkStatusByCommands(commands: CommandType[]): UserWorkStatus["workStatus"] {
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
}

function checkTrafficExpense(userCommands: CommandType[]) {
  // 「リモート出勤」よりあとに「出社」がなければ交通費はかからず、それ以外は必要
  return (
    userCommands.lastIndexOf("CLOCK_IN_AND_ALL_DAY_REMOTE_OR_SWITCH_TO_ALL_DAY_REMOTE") <=
    userCommands.lastIndexOf("CLOCK_IN_OR_SWITCH_TO_OFFICE")
  );
}

import { Message } from "@hi-se/web-api/src/response/ConversationsHistoryResponse";

export type CommandType = keyof typeof COMMAND_TYPE;
export type Commands = (typeof COMMAND_TYPE)[CommandType];
export const COMMAND_TYPE = {
  CLOCK_IN: [":shukkin:", ":sagyoukaishi:", ":kinmukaishi:"],
  CLOCK_IN_OR_SWITCH_TO_OFFICE: [":shussha:"],
  CLOCK_IN_AND_ALL_DAY_REMOTE_OR_SWITCH_TO_ALL_DAY_REMOTE: [":remoteshukkin:"],
  SWITCH_TO_REMOTE: [":remote:"],
  CLOCK_OUT: [":taikin:", ":sagyoushuuryou:", ":saishuutaikin:", ":kinmushuuryou:"],
} as const;

export function getCommandRegExp(commands: Commands | Commands[]): RegExp {
  if (Array.isArray(commands)) {
    return new RegExp(`^\\s*(${commands.flat().join("|")})\\s*\$`);
  } else {
    return new RegExp(`^\\s*(${commands.join("|")})\\s*\$`);
  }
}

export function getCommandType(message: Message): CommandType | undefined {
  const text = message.text;
  if (!text) {
    return;
  }
  if (text.match(getCommandRegExp(COMMAND_TYPE.CLOCK_IN))) {
    return "CLOCK_IN";
  } else if (text.match(getCommandRegExp(COMMAND_TYPE.CLOCK_IN_AND_ALL_DAY_REMOTE_OR_SWITCH_TO_ALL_DAY_REMOTE))) {
    return "CLOCK_IN_AND_ALL_DAY_REMOTE_OR_SWITCH_TO_ALL_DAY_REMOTE";
  } else if (text.match(getCommandRegExp(COMMAND_TYPE.CLOCK_IN_OR_SWITCH_TO_OFFICE))) {
    return "CLOCK_IN_OR_SWITCH_TO_OFFICE";
  } else if (text.match(getCommandRegExp(COMMAND_TYPE.SWITCH_TO_REMOTE))) {
    return "SWITCH_TO_REMOTE";
  } else if (text.match(getCommandRegExp(COMMAND_TYPE.CLOCK_OUT))) {
    return "CLOCK_OUT";
  } else {
    return undefined;
  }
}

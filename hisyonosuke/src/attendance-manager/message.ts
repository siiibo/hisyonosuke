import { GasWebClient as SlackClient } from "@hi-se/web-api";
import { z } from "zod";
import { getDate, subDays, set } from "date-fns";
import { REACTION } from "./reaction";
import { getUnixTimeStampString } from "./utilities";

export const MessageSchema = z.object({
  type: z.literal("message"),
  user: z.string(),
  text: z.string(),
  ts: z.string(),
  reactions: z
    .array(
      z.object({
        name: z.string(),
        users: z.array(z.string()),
      })
    )
    .optional(),
});
export type Message = z.infer<typeof MessageSchema>;
export type ProcessedMessage = Message & { isProcessed: true };
export type UnprocessedMessage = Message & { isProcessed: false };

export function getCategorizedDailyMessages(
  client: SlackClient,
  channelId: string,
  botUserId: string,
  dateStartHour: number
): { processedMessages: ProcessedMessage[]; unprocessedMessages: UnprocessedMessage[] } {
  const messages = getDailyMessages(client, channelId, dateStartHour);
  const messagesWithoutError = messages.filter((message) => !isErrorMessage(message, botUserId));

  // NOTE: エラーリアクションがついているメッセージは返り値に含めない
  return messagesWithoutError.reduce(
    (acc, message) => {
      return isProcessedMessage(message, botUserId)
        ? {
            ...acc,
            processedMessages: [...acc.processedMessages, { ...message, isProcessed: true }],
          }
        : {
            ...acc,
            unprocessedMessages: [...acc.unprocessedMessages, { ...message, isProcessed: false }],
          };
    },
    {
      processedMessages: [] as ProcessedMessage[],
      unprocessedMessages: [] as UnprocessedMessage[],
    }
  );
}

function getDailyMessages(client: SlackClient, channelId: string, dateStartHour: number) {
  const now = new Date();
  const oldest = set(now, {
    hours: dateStartHour,
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
    ...(now.getHours() <= dateStartHour && { date: getDate(subDays(now, 1)) }),
  });

  const _messages =
    client.conversations.history({
      channel: channelId,
      oldest: getUnixTimeStampString(oldest),
      inclusive: true,
    }).messages || [];

  // 時系列昇順に並び替え
  return _messages.filter(isMessage).reverse();
}

function isMessage(message: unknown): message is Message {
  return MessageSchema.safeParse(message).success;
}

function isErrorMessage(message: Message, botUserId: string): boolean {
  if (!message.reactions) {
    return false;
  }
  return message.reactions.some((reaction) => {
    if (!reaction.users) {
      return false;
    }
    return reaction.users?.includes(botUserId) && reaction.name === REACTION.ERROR;
  });
}

function isProcessedMessage(message: Message, botUserId: string): boolean {
  if (!message.reactions) {
    return false;
  }
  return message.reactions?.some((reaction) => {
    if (!reaction.name) {
      return false;
    }
    return (
      reaction.users?.includes(botUserId) &&
      [REACTION.DONE_FOR_TIME_RECORD, REACTION.DONE_FOR_REMOTE_MEMO, REACTION.DONE_FOR_LOCATION_SWITCH].includes(
        reaction.name
      )
    );
  });
}

import type { GasWebClient as SlackClient } from "@hi-se/web-api";
import { getDate, set, subDays } from "date-fns";
import * as R from "remeda";
import { z } from "zod";
import { REACTION, ReactionSchema } from "./reaction";
import { getUnixTimeStampString } from "./utilities";

export const MessageSchema = z
  .object({
    user: z.string(),
    text: z.string(),
    ts: z.string(),
    reactions: ReactionSchema.array().optional(),
  })
  .transform((message) => ({ ...message, date: new Date(Number.parseInt(message.ts) * 1000) }));
export type Message = z.infer<typeof MessageSchema>;
export type ProcessedMessage = Message & { isProcessed: true };
export type UnprocessedMessage = Message & { isProcessed: false };

export function getCategorizedDailyMessages(
  client: SlackClient,
  channelId: string,
  botUserId: string,
  dateStartHour: number,
  date: Date,
): { processedMessages: ProcessedMessage[]; unprocessedMessages: UnprocessedMessage[] } {
  const messages = getDailyMessages(client, channelId, dateStartHour, date);
  const messagesWithoutError = messages.filter((message) => !isErrorMessage(message, botUserId));

  // NOTE: エラーリアクションがついているメッセージは返り値に含めない
  return categorizeMessage(messagesWithoutError, botUserId);
}

function categorizeMessage(
  messages: Message[],
  botUserId: string,
): { processedMessages: ProcessedMessage[]; unprocessedMessages: UnprocessedMessage[] } {
  return messages.reduce(
    (acc, message) => {
      return isProcessedMessage(message, botUserId)
        ? {
            // biome-ignore lint/performance/noAccumulatingSpread: パフォーマンスを重視していないので一旦許容
            ...acc,
            processedMessages: [...acc.processedMessages, { ...message, isProcessed: true }],
          }
        : {
            // biome-ignore lint/performance/noAccumulatingSpread: パフォーマンスを重視していないので一旦許容
            ...acc,
            unprocessedMessages: [...acc.unprocessedMessages, { ...message, isProcessed: false }],
          };
    },
    {
      processedMessages: [] as ProcessedMessage[],
      unprocessedMessages: [] as UnprocessedMessage[],
    },
  );
}

function getDailyMessages(client: SlackClient, channelId: string, dateStartHour: number, date: Date) {
  const oldest = getDayStartAsDate(date, dateStartHour);
  const _messages =
    client.conversations.history({
      channel: channelId,
      oldest: getUnixTimeStampString(oldest),
      inclusive: true,
    }).messages || [];

  return R.pipe(
    _messages,
    R.map((m) => {
      const parsed = MessageSchema.safeParse(m);
      return parsed.success ? parsed.data : undefined;
    }),
    R.filter((m): m is Message => !!m),
    R.sortBy((m) => m.date),
  );
}

export function getDayStartAsDate(date: Date, dateStartHour: number): Date {
  const baseDate = date.getHours() < dateStartHour ? subDays(date, 1) : date;
  return set(baseDate, {
    hours: dateStartHour,
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
  });
}

export function isErrorMessage(message: Message, botUserId: string): boolean {
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
  return message.reactions.some((reaction) => {
    return (
      reaction.users.includes(botUserId) &&
      [REACTION.DONE_FOR_TIME_RECORD, REACTION.DONE_FOR_REMOTE_MEMO, REACTION.DONE_FOR_LOCATION_SWITCH].includes(
        reaction.name,
      )
    );
  });
}

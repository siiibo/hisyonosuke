import { GasWebClient as SlackClient } from '@hi-se/web-api';
import { Message } from '@hi-se/web-api/src/response/ConversationsHistoryResponse';
import { setHours, setMinutes, setSeconds, subDays } from 'date-fns';
import { REACTION } from './reaction';
import { getUnixTimeStampString } from './utilities';

export function isErrorMessage(message: Message, botUserId: string): boolean {
  if (!message.reactions) { return false; }
  return message.reactions.some(reaction => {
    if (!reaction.users) { return false; }
    return (
      reaction.users?.includes(botUserId) &&
      reaction.name === REACTION.ERROR
    );
  });
}

export function isProcessedMessage(message: Message, botUserId: string): boolean {
  if (!message.reactions) { return false; }
  return message.reactions?.some(reaction => {
    if (!reaction.name) { return false; }
    return (
      reaction.users?.includes(botUserId) &&
      [
        REACTION.DONE_FOR_TIME_RECORD,
        REACTION.DONE_FOR_REMOTE_MEMO,
        REACTION.DONE_FOR_LOCATION_SWITCH
      ].includes(reaction.name)
    );
  });
}

export function getDailyMessages(client: SlackClient, channelId: string, dateStartHour: number) {
  const now = new Date();
  let oldest = new Date();
  oldest = setHours(oldest, dateStartHour);
  oldest = setMinutes(oldest, 0);
  oldest = setSeconds(oldest, 0);
  if (now.getHours() <= dateStartHour) {
    oldest = subDays(oldest, 1);
  }

  const messages = client.conversations.history({
    channel: channelId,
    oldest: getUnixTimeStampString(oldest),
    inclusive: true
  }).messages;

  // 時系列昇順に並び替え
  return messages ? messages.reverse() : [];
}

export function getProcessedMessages(messages: Message[], botUserId: string) {
  const messagesWithoutError = messages.filter(message => !isErrorMessage(message, botUserId));
  return messagesWithoutError.filter(message => isProcessedMessage(message, botUserId));
}

export function getUnprocessedMessages(messages: Message[], botUserId: string) {
  const messagesWithoutError = messages.filter(message => !isErrorMessage(message, botUserId));
  const unprocessedMessages = messagesWithoutError.filter(message => !isProcessedMessage(message, botUserId));
  return unprocessedMessages;
}

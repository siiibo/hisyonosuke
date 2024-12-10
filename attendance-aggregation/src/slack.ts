import { GasWebClient as SlackClient } from '@hi-se/web-api'
import { Message } from '@hi-se/web-api/src/response/ConversationsHistoryResponse';
import { format } from 'date-fns';
import { objectify } from 'radash';
import { getDateFromUnixTimeStampString, getUnixTimeStampString } from './utils';

//TOOD: zodに置き換え
export interface MessageHistory {
  user: string,
  dateString: string,
  message: string,
  reactions: string[],
}

const HISYONOSUKE_USER_ID = 'U01AY3RHR42'

export const getConversationHistory = (client: SlackClient, channelId: string, oldest: Date, latest: Date, userIdList: Record<string, string>): MessageHistory[] => {
  const channelMessages = _getConversationsHistoryAll(client, channelId, getUnixTimeStampString(oldest), getUnixTimeStampString(latest));

  return channelMessages.map(message => {
    return {
      user: message.user ? userIdList[message.user] : "",
      dateString: message.ts ? format(getDateFromUnixTimeStampString(message.ts), 'yyyy/MM/dd HH:mm:ss') : "",
      message: message.text ?? "",
      reactions: message.reactions ? message.reactions.filter(reaction => reaction.users?.includes(HISYONOSUKE_USER_ID)).map(reaction => reaction.name ? reaction.name : '') : []
    }
  })
}

const _getConversationsHistoryAll = (client: SlackClient, channelId: string, oldest: string, latest: string) => {
  let _messages: Message[] = [];
  let cursor: string | undefined = undefined;

  while (true) {
    const { has_more, response_metadata, messages } = client.conversations.history({
      channel: channelId,
      inclusive: true,
      include_all_metadata: true,
      oldest,
      latest,
      limit: 1000,
      cursor: cursor,
    });
    if (!messages) {
      break
    }
    _messages = [..._messages, ...messages];

    if (!has_more || !response_metadata || !response_metadata.next_cursor) {
      break;
    }
    cursor = response_metadata.next_cursor;
  }

  return _messages;
}

export const getUserIdList = (client: SlackClient) => {
  const members = client.users.list({}).members; // TODO: pagination
  if (!members) { return {} }

  const userIdAndEmail = members.map(member => {
    return {
      userId: member.id ? member.id : '',
      userEmail: member.profile && member.profile.email ? member.profile.email : '',
    }
  });

  return objectify(userIdAndEmail, f => f.userId, f => f.userEmail) //TODO: define type
}

export const getSlackClient = (token: string) => {
  return new SlackClient(token);
}

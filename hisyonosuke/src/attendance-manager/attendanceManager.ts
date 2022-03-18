import { GenericMessageEvent, SlackEvent } from '@slack/bolt';
import { StringIndexed } from '@slack/bolt/dist/types/helpers';
import { GasWebClient as SlackClient } from '@hi-se/web-api';
import { format, setHours, setMinutes, setSeconds, subDays } from 'date-fns';

import { getCompanyEmployees, getWorkRecord, setTimeClocks, updateWorkRecord, WorkRecordControllerRequestBody } from './freee';
import { getUnixTimeStampString, isWorkDay } from './utilities';
import { getConfig, initConfig } from './config';
import { Message } from '@hi-se/web-api/src/response/ConversationsHistoryResponse';

enum IncomingEventType {
  Event,
  Action,
  Command,
  Options,
  ViewAction,
  Shortcut,
}

interface UserWorkStatus {
  userSlackId: string,
  workStatus: '勤務中（出社）' | '勤務中（リモート）' | '退勤済み' // 未出勤は現状利用していない
  needTrafficExpense: boolean,
  processedMessages: Message[],
}
type CommandType = keyof typeof COMMAND_TYPE;
type Commands = typeof COMMAND_TYPE[keyof typeof COMMAND_TYPE]
type ActionType = 'clock_in' | 'clock_out' | 'clock_out_and_add_remote_memo' | 'switch_work_status_to_office' | 'switch_work_status_to_remote';

const DATE_START_HOUR = 4;
const COMMAND_TYPE = {
  CLOCK_IN: [':shukkin:', ':sagyoukaishi:', ':kinmukaishi:',],
  CLOCK_IN_OR_SWITCH_TO_OFFICE: [':shussha:'],
  CLOCK_IN_AND_ALL_DAY_REMOTE_OR_SWITCH_TO_ALL_DAY_REMOTE: [':remoteshukkin:'],
  SWITCH_TO_REMOTE: [':remote:'],
  CLOCK_OUT: [':taikin:', ':sagyoushuuryou:', ':saishuutaikin:', ':kinmushuuryou:']
} as const;

const REACTION = {
  DONE_FOR_TIME_RECORD: 'dakoku_ok',
  DONE_FOR_REMOTE_MEMO: 'memo_remote_ok',
  DONE_FOR_LOCATION_SWITCH: 'switch_location_ok',
  ERROR: 'dakoku_memo_error',
}

export const initAttendanceManager = () => {
  initConfig();

  const targetFunction = periodicallyCheckForAttendanceManager;

  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === targetFunction.name) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp
    .newTrigger(targetFunction.name)
    .timeBased()
    .everyMinutes(5) //TODO: 定数化
    .create();
}

/**
 * doPost移行用
 * DoPost Eventのparse処理をdoPost内で行うように変更し、attendanceManagementに置き換える予定
 */
export const attendanceManagerProxy = (e: GoogleAppsScript.Events.DoPost) => {
  const payload = getPayload(e);
  const incomingEventType = getIncomingEventType(payload);

  attendanceManager(payload, incomingEventType);
}

/**
 * attendanceManagementのentry point
 */
const attendanceManager = (payload: StringIndexed, incomingEventType: IncomingEventType) => {
  switch (incomingEventType) {
    case IncomingEventType.Event:
      handleSlackEvent(payload.event as SlackEvent);
      break;
  }
}

export const periodicallyCheckForAttendanceManager = () => {
  const now = new Date();
  if (!isWorkDay(now)) {
    return;
  }

  const client = getSlackClient();

  const { TEST_CHANNEL_ID, ATTENDANCE_CHANNEL_ID, PART_TIMER_CHANNEL_ID } = getConfig();

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
const checkAttendance = (client: SlackClient, channelId: string) => {
  const { FREEE_COMPANY_ID } = getConfig();
  const hisyonosukeUserId = 'U01AY3RHR42'; // ボットはbot_idとuser_idの2つのidを持ち、リアクションにはuser_idが使われる
  const doneReactionForTimeRecord = 'dakoku_ok';
  const doneReactionForRemoteMemo = 'memo_remote_ok';
  const doneReactionForLocationSwitching = 'switch_location_ok';
  const errorReaction = 'dakoku_memo_error';

  const dateStartHour = 4;

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

  if (!messages?.length) {
    return;
  }

  const messagesWithoutError = messages.filter(message => {
    return !message.reactions?.filter(reaction => {
      return (
        errorReaction === reaction.name &&
        reaction.users.includes(hisyonosukeUserId)
      );
    }).length
  });


  const unprocessedClockIn = messagesWithoutError.filter(message => {
    return message.text.match(/^\s*(:shukkin:|:shussha:|:sagyoukaishi:|:kinmukaishi:|:remoteshukkin:)\s*$/) &&
      !message.reactions?.filter(reaction => {
        return (
          [doneReactionForTimeRecord, doneReactionForLocationSwitching].includes(reaction.name) &&
          reaction.users.includes(hisyonosukeUserId)
        );
      }).length
  });

  const unprocessedClockOut = messagesWithoutError.filter(message => {
    return message.text.match(/^\s*(:taikin:|:sagyoushuuryou:|:saishuutaikin:|:kinmushuuryou:)\s*$/) &&
      !message.reactions?.filter(reaction => {
        return (
          [doneReactionForTimeRecord].includes(reaction.name) &&
          reaction.users.includes(hisyonosukeUserId)
        );
      }).length
  });

  const unprocessedRemote = messagesWithoutError.filter(message => {
    return message.text.match(/^\s*(:remote:|:remoteshukkin:)\s*$/) &&
      !message.reactions?.filter(reaction => {
        return (
          [doneReactionForRemoteMemo, doneReactionForLocationSwitching].includes(reaction.name) &&
          reaction.users.includes(hisyonosukeUserId)
        );
      }).length
  });

  unprocessedClockIn.forEach(clockInMessage => {
    const clockInDate = new Date(parseInt(clockInMessage.ts) * 1000);
    const clockInBaseDate = new Date(clockInDate.getTime());

    const clockInParams = {
      company_id: FREEE_COMPANY_ID,
      type: 'clock_in' as const,
      base_date: format(clockInBaseDate, 'yyyy-MM-dd'),
      datetime: format(clockInDate, 'yyyy-MM-dd HH:mm:ss')
    };

    let employeeId: number;

    try {
      employeeId = getFreeeEmployeeIdFromSlackUserId(client, clockInMessage.user, FREEE_COMPANY_ID);
    } catch (e) {
      console.error(e.stack);
      console.error(`user:${employeeId}, type:${clockInParams.type}, base_date:${clockInParams.base_date}, datetime:${clockInParams.datetime}`);
      const errorFeedBackMessage = e.toString();;
      client.chat.postMessage({
        channel: channelId,
        text: errorFeedBackMessage,
        thread_ts: clockInMessage.ts
      });
      client.reactions.add({
        channel: channelId,
        name: errorReaction,
        timestamp: clockInMessage.ts
      });

      throw new Error(e); // FIXME: 後続の処理を走らせないためにおいているが、他の方法がありそう
    }

    const matchedUnprocessedRemote = unprocessedRemote.filter(remoteMessage => {
      return remoteMessage.user === clockInMessage.user;
    });

    // リモート出勤 → 出社のパターン
    if (matchedUnprocessedRemote.length === 1 && clockInMessage.text === ':shussha:') {
      const remoteMessage = matchedUnprocessedRemote[0];
      try {
        client.reactions.add({
          channel: channelId,
          name: doneReactionForLocationSwitching,
          timestamp: remoteMessage.ts
        });
        client.reactions.add({
          channel: channelId,
          name: doneReactionForLocationSwitching,
          timestamp: clockInMessage.ts
        });
      } catch (e) {
        console.error(e.stack);
        console.error(`user:${employeeId}, type:${clockInParams.type}, base_date:${clockInParams.base_date}, datetime:${clockInParams.datetime}`);

        const errorFeedBackMessage = e.toString(); //TODO: エラー内容の知見が溜まったら条件分岐を行う
        client.chat.postMessage({
          channel: channelId,
          text: errorFeedBackMessage,
          thread_ts: clockInMessage.ts
        });
        client.reactions.add({
          channel: channelId,
          name: errorReaction,
          timestamp: clockInMessage.ts
        });
      }

      return;
    }

    try {
      setTimeClocks(employeeId, clockInParams);
      client.reactions.add({
        channel: channelId,
        name: doneReactionForTimeRecord,
        timestamp: clockInMessage.ts
      });
      console.info(`user:${employeeId}, type:${clockInParams.type}, base_date:${clockInParams.base_date}, datetime:${clockInParams.datetime}`);
    } catch (e) {
      console.error(e.stack);
      console.error(`user:${employeeId}, type:${clockInParams.type}, base_date:${clockInParams.base_date}, datetime:${clockInParams.datetime}`);

      let errorFeedBackMessage = '';
      if (e.message.includes("打刻の種類が正しくありません。")) {
        errorFeedBackMessage = '既に打刻済みです';
      } else {
        errorFeedBackMessage = e.toString();
      }

      client.chat.postMessage({
        channel: channelId,
        text: errorFeedBackMessage,
        thread_ts: clockInMessage.ts
      });
      client.reactions.add({
        channel: channelId,
        name: errorReaction,
        timestamp: clockInMessage.ts
      });
    }
  });

  unprocessedClockOut.forEach(clockOutMessage => {
    const clockOutDate = new Date(parseInt(clockOutMessage.ts) * 1000);
    const clockOutBaseDate = clockOutDate.getHours() > dateStartHour
      ? new Date(clockOutDate.getTime())
      : subDays(clockOutDate, 1);

    const clockOutParams = {
      company_id: FREEE_COMPANY_ID,
      type: 'clock_out' as const,
      base_date: format(clockOutBaseDate, 'yyyy-MM-dd'),
      datetime: format(clockOutDate, 'yyyy-MM-dd HH:mm:ss')
    };

    const matchedUnprocessedRemote = unprocessedRemote.filter(remoteMessage => {
      return remoteMessage.user === clockOutMessage.user;
    });

    let employeeId: number;
    try {
      employeeId = getFreeeEmployeeIdFromSlackUserId(client, clockOutMessage.user, FREEE_COMPANY_ID);
    } catch (e) {
      console.error(e.stack);
      console.error(`user:${employeeId}, type:${clockOutParams.type}, base_date:${clockOutParams.base_date}, datetime:${clockOutParams.datetime}`);
      const errorFeedBackMessage = e.toString();;
      client.chat.postMessage({
        channel: channelId,
        text: errorFeedBackMessage,
        thread_ts: clockOutMessage.ts
      });
      client.reactions.add({
        channel: channelId,
        name: errorReaction,
        timestamp: clockOutMessage.ts
      });

      throw new Error(e); // FIXME: 後続の処理を走らせないためにおいているが、他の方法がありそう
    }

    try {
      setTimeClocks(employeeId, clockOutParams);
      client.reactions.add({
        channel: channelId,
        name: doneReactionForTimeRecord,
        timestamp: clockOutMessage.ts
      });
      console.info(`user:${employeeId}, type:${clockOutParams.type}, base_date:${clockOutParams.base_date}, datetime:${clockOutParams.datetime}`);
    } catch (e) {
      // FIXME: 例外発生時の処理をちゃんと考える (出勤されていない場合など)
      // NOTE: 退勤は打刻の重複が許容されているので出勤のエラー対応とは異なる
      console.error(e.stack);
      console.error(`user:${employeeId}, type:${clockOutParams.type}, base_date:${clockOutParams.base_date}, datetime:${clockOutParams.datetime}`);

      let errorFeedBackMessage = '';
      if (e.message.includes("打刻の種類が正しくありません。")) {
        errorFeedBackMessage = '出勤打刻が完了していないか、退勤の上書きができない値です.';
      } else {
        errorFeedBackMessage = e.toString();
      }

      client.chat.postMessage({
        channel: channelId,
        text: errorFeedBackMessage,
        thread_ts: clockOutMessage.ts
      });
      client.reactions.add({
        channel: channelId,
        name: errorReaction,
        timestamp: clockOutMessage.ts
      });
    }
    if (matchedUnprocessedRemote.length === 1) {
      const remoteMessage = matchedUnprocessedRemote[0];
      const targetDate = format(clockOutDate, 'yyyy-MM-dd');
      const workRecord = getWorkRecord(employeeId, targetDate, FREEE_COMPANY_ID);
      const remoteParams: WorkRecordControllerRequestBody = {
        company_id: FREEE_COMPANY_ID,
        clock_in_at: format(new Date(workRecord.clock_in_at), 'yyyy-MM-dd HH:mm:ss'),
        clock_out_at: format(new Date(workRecord.clock_out_at), 'yyyy-MM-dd HH:mm:ss'),
        note: workRecord.note ? `${workRecord.note} リモート` : 'リモート',
        break_records: workRecord.break_records.map(record => {
          return {
            clock_in_at: format(new Date(record.clock_in_at), 'yyyy-MM-dd HH:mm:ss'),
            clock_out_at: format(new Date(record.clock_out_at), 'yyyy-MM-dd HH:mm:ss')
          }
        })
      }

      try {
        updateWorkRecord(employeeId, targetDate, remoteParams);
        client.reactions.add({
          channel: channelId,
          name: doneReactionForRemoteMemo,
          timestamp: remoteMessage.ts
        });
        console.info(`user:${employeeId}, type:remote, clock_in_at:${remoteParams.clock_in_at}, clock_out_at:${remoteParams.clock_out_at}, note:${remoteParams.note}`);

      } catch (e) {
        console.error(e.stack);
        console.error(`user:${employeeId}, type:remote, clock_in_at:${remoteParams.clock_in_at}, clock_out_at:${remoteParams.clock_out_at}, note:${remoteParams.note}`);

        const errorFeedBackMessage = e.toString(); //TODO: エラー内容の知見が溜まったら条件分岐を行う
        client.chat.postMessage({
          channel: channelId,
          text: errorFeedBackMessage,
          thread_ts: remoteMessage.ts
        });
        client.reactions.add({
          channel: channelId,
          name: errorReaction,
          timestamp: remoteMessage.ts
        });
      }
    }
  });
}

const _checkAttendance = (client: SlackClient, channelId: string) => {
  const messages = getDailyMessages(client, channelId);
  if (!messages.length) { return }

  const getUserWorkStatus = getterForUserWorkStatusesByMessages(messages);

  const unprocessedMessages = messages; //FIXME; 指定のreactionを含まないメッセージ配列に変更

  const unprocessedCommands = unprocessedMessages.map(message => {
    return {
      message,
      commandType: getCommandType(message)
    }
  }).filter(_ => _);

  const actionsToProcess = unprocessedCommands.map(({ message, commandType }) => {
    return {
      message,
      actionType: getActionType(commandType, getUserWorkStatus(message.user))
    }
  });

  actionsToProcess.forEach(({ message, actionType }) => {
    execAction(message, actionType);
  });
}

const execAction = (message: Message, actionType: ActionType) => {
  switch (actionType) {
    case 'clock_in':
      // TODO: 打刻・スタンプ
      break;
    case 'switch_work_status_to_office':
      //TODO: スタンプのみ
      break;
    case 'switch_work_status_to_remote':
      //TODO: スタンプのみ
      break;
    case 'clock_out':
      //TODO: 打刻・スタンプ
      break;
    case 'clock_out_and_add_remote_memo':
    //TODO: 打刻・スタンプ・メモ追加
  }

}


const getDailyMessages = (client: SlackClient, channelId: string) => {
  const now = new Date();
  let oldest = new Date();
  oldest = setHours(oldest, DATE_START_HOUR);　// グローバル変数に依存
  oldest = setMinutes(oldest, 0);
  oldest = setSeconds(oldest, 0);
  if (now.getHours() <= DATE_START_HOUR) {
    oldest = subDays(oldest, 1);
  }

  const messages = client.conversations.history({
    channel: channelId,
    oldest: getUnixTimeStampString(oldest),
    inclusive: true
  }).messages;

  return messages;
}



const getterForUserWorkStatusesByMessages = (messages: Message[]): (slackUserId: string) => UserWorkStatus => {
  //FIXME: checkAttendanceとの重複 ↓
  const hisyonosukeUserId = 'U01AY3RHR42'; // ボットはbot_idとuser_idの2つのidを持ち、リアクションにはuser_idが使われる
  const doneReactionForTimeRecord = 'dakoku_ok';
  const doneReactionForRemoteMemo = 'memo_remote_ok';
  const doneReactionForLocationSwitching = 'switch_location_ok';
  const errorReaction = 'dakoku_memo_error';

  const messagesWithoutError = messages.filter(message => {
    return !message.reactions?.filter(reaction => {
      return (
        reaction.users.includes(hisyonosukeUserId) &&
        reaction.name === errorReaction
      );
    }).length
  });
  const processedMessages = messagesWithoutError.filter(message => {
    return message.reactions?.filter(reaction => {
      return (
        reaction.users.includes(hisyonosukeUserId) &&
        [doneReactionForTimeRecord, doneReactionForRemoteMemo, doneReactionForLocationSwitching].includes(reaction.name)
      )
    }).length
  });

  const clockedInUserIds = Array.from(new Set(processedMessages.map(message => message.user)));
  const clockedInUserWorkStatuses = clockedInUserIds.map(userSlackId => {
    const userMessages = processedMessages.filter(message => message.user === userSlackId);
    const workStatus = getUserWorkStatusByLastCommand(userMessages[userMessages.length - 1].text);

    // 「状態がリモート&出社が一つもない」もののみ交通費がかからず、それ以外は必要
    // TODO: 検証
    // 「リモート出勤より後に出社がなければ交通費は発生しない」
    // 逆にそれ以外は発生する
    const needTrafficExpense = !(
      workStatus === '勤務中（リモート）' &&
      userMessages.every(message => !message.text.match(/^\s*:shussha:\s*$/))
    );

    return {
      userSlackId,
      needTrafficExpense,
      workStatus,
      processedMessages: userMessages
    }
  });

  return (userSlackId: string) => {
    const matchedUserWorkStatus = clockedInUserWorkStatuses.filter(userWorkStatus => userWorkStatus.userSlackId === userSlackId);
    if (matchedUserWorkStatus.length === 0) {
      return undefined;
    } else if (matchedUserWorkStatus.length === 1) {
      matchedUserWorkStatus[0];
    } else {
      throw new Error(); //TODO: エラーメッセージ
    }
  }
}

const getUserWorkStatusByLastCommand = (lastUserCommand: string): UserWorkStatus['workStatus'] => {

  // 最後のuserMessageからworkStatusを算出できるはず
  // 休憩を打刻できるように変更する場合は、休憩打刻を除いた最後のメッセージを確認
  // TODO: ↑の検証
  if (lastUserCommand.match(getCommandRegExp(COMMAND_TYPE.CLOCK_OUT))) {
    return '退勤済み';
  } else if (lastUserCommand.match(
    getCommandRegExp([COMMAND_TYPE.CLOCK_IN, COMMAND_TYPE.CLOCK_IN_OR_SWITCH_TO_OFFICE])
  )) {
    return '勤務中（出社）';
  } else if (lastUserCommand.match(
    getCommandRegExp([COMMAND_TYPE.CLOCK_IN_AND_ALL_DAY_REMOTE_OR_SWITCH_TO_ALL_DAY_REMOTE, COMMAND_TYPE.SWITCH_TO_REMOTE])
  )) {
    return '勤務中（リモート）';
  } else {
    // ここには来ない想定
    throw new Error(); //TODO: エラーメッセージ
  }
}

const getActionType = (commandType: CommandType, userWorkStatus: UserWorkStatus | undefined): ActionType => {
  switch (commandType) {
    case 'CLOCK_IN':
      return 'clock_in';
    case 'CLOCK_IN_AND_ALL_DAY_REMOTE_OR_SWITCH_TO_ALL_DAY_REMOTE':
      return userWorkStatus?.workStatus === '勤務中（出社）' ? 'switch_work_status_to_remote' : 'clock_in';
    case 'CLOCK_IN_OR_SWITCH_TO_OFFICE':
      return userWorkStatus?.workStatus === '勤務中（リモート）' ? 'switch_work_status_to_office' : 'clock_in';
    case 'SWITCH_TO_REMOTE':
      return 'switch_work_status_to_remote';
    case 'CLOCK_OUT':
      return 'clock_out';
  }
}

const getCommandRegExp = (commands: Commands | Commands[]): RegExp => {
  if (Array.isArray(commands)) {
    return new RegExp(`^\\s*(${commands.flat().join('|')})\\s*\$`);
  } else {
    return new RegExp(`^\\s*(${commands.join('|')})\\s*\$`);
  }
}

const getCommandType = (message: Message): CommandType | undefined => {
  if (message.text.match(getCommandRegExp(COMMAND_TYPE.CLOCK_IN))) {
    return 'CLOCK_IN';
  } else if (message.text.match(getCommandRegExp(COMMAND_TYPE.CLOCK_IN_AND_ALL_DAY_REMOTE_OR_SWITCH_TO_ALL_DAY_REMOTE))) {
    return 'CLOCK_IN_AND_ALL_DAY_REMOTE_OR_SWITCH_TO_ALL_DAY_REMOTE';
  } else if (message.text.match(getCommandRegExp(COMMAND_TYPE.CLOCK_IN_OR_SWITCH_TO_OFFICE))) {
    return 'CLOCK_IN_OR_SWITCH_TO_OFFICE';
  } else if (message.text.match(getCommandRegExp(COMMAND_TYPE.SWITCH_TO_REMOTE))) {
    return 'SWITCH_TO_REMOTE';
  } else if (message.text.match(getCommandRegExp(COMMAND_TYPE.CLOCK_OUT))) {
    return 'CLOCK_OUT';
  } else {
    return undefined;
  }
}


// タイムトリガー形式にしたので削除予定
const handleSlackEvent = (event: SlackEvent) => {
  console.log(event);
  const client = getSlackClient();
  switch (event.type) {
    case 'message':
      const message = getMessageListener(client, event);
      // TODO: ここではスタンプ押した際に投稿者へのフィードバックを行う。
      message(/:shukkin:|:shussha:|:sagyoukaishi:|:kinmukaishi:|:remoteshukkin:/, ({ client, event }) => {
        client.chat.postMessage({
          text: '出勤テスト（ephemeralに変更予定）',
          channel: event.channel,
        });
      })

      message(/:taikin:|:sagyoushuuryou:|:saishuutaikin:|:kinmushuuryou:/, ({ client, event }) => {
        client.chat.postMessage({
          text: '退勤テスト（ephemeralに変更予定）',
          channel: event.channel,
        });
      })

      message(/:remote:|:remoteshukkin:/, ({ client, event }) => {
        console.log(event);
      })
      break;
  }
}



const getMessageListener = (client: SlackClient, event: SlackEvent) => {
  const isOriginalCommand = (target: string, command: string | RegExp) => {
    if (typeof command === 'string') {
      const commandRegExp = new RegExp(command);
      return target.match(commandRegExp);
    } else if (command instanceof RegExp) {
      // 週次之介のように前後の文字列でさらに制限をかける場合は一旦stringにする必要がある
      // その場合、RegExp.prototype.toString()はスラッシュとflagを含めて返すため、取り除く処理が必要
      return target.match(command)
    } else {
      throw new Error('TypeError');
    }
  };

  if (event.type === 'message') {
    if (!event.subtype) {
      // とりあえずsubtypeを持たない pure message だけ対応
      return (command: string | RegExp, callback: ({ client, event }: { client: SlackClient, event: GenericMessageEvent }) => void) => {
        if (isOriginalCommand((event as GenericMessageEvent).text, command)) {
          callback({ client, event: event as GenericMessageEvent });
        }
      }
    }
  }
}

const getFreeeEmployeeIdFromSlackUserId = (client: SlackClient, slackUserId: string, companyId: number): number => {
  // TODO: PropertiesService等を挟むようにする（毎回APIを投げない）
  const email = client.users.info({
    user: slackUserId
  }).user.profile.email;
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

const getSlackClient = () => {
  const token = PropertiesService.getScriptProperties().getProperty('SLACK_TOKEN');
  return new SlackClient(token);
}

const getPayload = (e: GoogleAppsScript.Events.DoPost): StringIndexed => {
  if (e.postData.type === "application/json") {
    return JSON.parse(e.postData.contents);
  } else if (e.postData.type === "application/x-www-form-urlencoded") {
    return e.parameter
  } else {
    throw new Error('Invalid incoming payload.');
  }
}

const getIncomingEventType = (body: StringIndexed): IncomingEventType => {
  if (body.event) {
    return IncomingEventType.Event;
  }
  if (body.command) {
    return IncomingEventType.Command;
  }
  if (body.name || body.type === 'block_suggestion') {
    return IncomingEventType.Options;
  }
  if (body.actions || body.type === ('dialog_submission' || 'workflow_step_edit')) {
    return IncomingEventType.Action;
  }
  if (body.type === ('shortcut' || 'message_action')) {
    return IncomingEventType.Shortcut;
  }
  if (body.type === 'view_submission' || body.type === 'view_closed') {
    return IncomingEventType.ViewAction;
  }
  return undefined;
}


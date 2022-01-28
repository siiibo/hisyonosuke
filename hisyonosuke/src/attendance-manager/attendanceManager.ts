import { GenericMessageEvent, SlackEvent } from '@slack/bolt';
import { StringIndexed } from '@slack/bolt/dist/types/helpers';
import { GasWebClient as SlackClient } from '@hi-se/web-api';
import { getCompanyEmployees, getWorkRecord, setTimeClocks, updateWorkRecord } from './freee';
import { getUnixTimeStampString, isWorkDay } from './utilities';
import { getConfig, initConfig } from './config';

enum IncomingEventType {
  Event,
  Action,
  Command,
  Options,
  ViewAction,
  Shortcut,
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
  checkAttendance(client);
}

/*
  NOTE:
  dateStartHour ~ 現在時刻までのメッセージから勤怠情報を取得→freeeへの登録を行う。
  triggerの呼び出し毎に、処理済みのメッセージも含めてチェックするという冗長な処理になってしまっている。
  いずれPropServiceなどを使って状態管理するほうが良いかもしれない。
 */
const checkAttendance = (client: SlackClient) => {
  const { FREEE_COMPANY_ID, TEST_CHANNEL_ID, ATTENDANCE_CHANNEL_ID } = getConfig();
  const channelId = TEST_CHANNEL_ID; // FIXME: ATTENDANCE_CHANNEL_IDに戻す
  const hisyonosukeUserId = 'U01AY3RHR42'; // ボットはbot_idとuser_idの2つのidを持ち、リアクションにはuser_idが使われる
  const doneReaction = 'white_check_mark';
  const doneReactionForRemote = 'pencil';
  const errorReaction = 'warning';

  const dateStartHour = 4;

  const now = new Date();
  let oldest = new Date();
  oldest.setHours(dateStartHour);
  oldest.setMinutes(0);
  if (now.getTime() <= dateStartHour) {
    oldest.setDate(now.getDate() - 1);
  }

  const messages = client.conversations.history({
    channel: channelId,
    oldest: getUnixTimeStampString(oldest),
    inclusive: true
  }).messages;

  if (!messages?.length) {
    return;
  }


  const unprocessedClockIn = messages.filter(message => {
    return message.text.match(/:shukkin:|:shussha:|:sagyoukaishi:|:kinmukaishi:|:remoteshukkin:/) &&
      !message.reactions?.filter(reaction => {
        return (
          [doneReaction, errorReaction].includes(reaction.name) &&
          reaction.users.includes(hisyonosukeUserId)
        );
      }).length
  });

  const unprocessedClockOut = messages.filter(message => {
    return message.text.match(/:taikin:|:saghoushuuryou:|:saishuutaikin:|:kinmushuuryou:/) &&
      !message.reactions?.filter(reaction => {
        return (
          [doneReaction, errorReaction].includes(reaction.name) &&
          reaction.users.includes(hisyonosukeUserId)
        );
      }).length
  });

  const unprocessedRemote = messages.filter(message => {
    return message.text.match(/:remote:|:remoteshukkin:/) &&
      !message.reactions?.filter(reaction => {
        return (
          [doneReactionForRemote, errorReaction].includes(reaction.name) &&
          reaction.users.includes(hisyonosukeUserId)
        );
      }).length
  });

  unprocessedClockIn.forEach(clockInMessage => {
    const employeeId = getFreeeEmployeeIdFromSlackUserId(client, clockInMessage.user);
    const date = new Date(parseInt(clockInMessage.ts) * 1000);

    try {
      const res = setTimeClocks(employeeId, {
        company_id: FREEE_COMPANY_ID,
        type: 'clock_in',
        datetime: date
      });
      client.reactions.add({
        channel: channelId,
        name: doneReaction,
        timestamp: clockInMessage.ts
      });
      console.log(res);
    } catch (e) {
      if (e.message.includes("打刻の種類が正しくありません。")) {
        client.chat.postEphemeral({
          channel: channelId,
          user: clockInMessage.user,
          text: '既に打刻済みです'
        });
      } else {
        // FIXME: 例外発生時の処理をちゃんと考える
        console.error(e);
        client.chat.postMessage({
          channel: TEST_CHANNEL_ID,
          text: JSON.stringify(e.message)
        });
      }
      client.reactions.add({
        channel: channelId,
        name: errorReaction,
        timestamp: clockInMessage.ts
      });
    }
  });

  unprocessedClockOut.forEach(clockOutMessage => {
    const employeeId = getFreeeEmployeeIdFromSlackUserId(client, clockOutMessage.user);
    const date = new Date(parseInt(clockOutMessage.ts) * 1000);
    let baseDate = new Date(date.getTime());
    if (date.getTime() < dateStartHour) {
      baseDate.setDate(date.getDate() - 1);
    }
    try {
      setTimeClocks(employeeId, {
        company_id: FREEE_COMPANY_ID,
        type: 'clock_out',
        base_date: baseDate,
        datetime: date
      });
      client.reactions.add({
        channel: channelId,
        name: doneReaction,
        timestamp: clockOutMessage.ts
      });

      const matchedUnprocessedRemote = unprocessedRemote.filter(remoteMessage => {
        return remoteMessage.user === clockOutMessage.user;
      });

      if (matchedUnprocessedRemote.length === 1) {
        const workRecord = getWorkRecord(employeeId, date);
        updateWorkRecord(employeeId, date, {
          company_id: FREEE_COMPANY_ID,
          clock_in_at: new Date(workRecord.clock_in_at).toISOString(), //TODO: 型をdate型に変える
          clock_out_at: new Date(workRecord.clock_out_at).toISOString(),
          note: workRecord.note ? `${workRecord.note} リモート` : 'リモート',
        });
        client.reactions.add({
          channel: channelId,
          name: doneReactionForRemote,
          timestamp: matchedUnprocessedRemote[0].ts
        });
      }

    } catch (e) {
      // FIXME: 例外発生時の処理をちゃんと考える (出勤されていない場合など)
      // NOTE: 退勤は打刻の重複が許容されているので出勤のエラー対応とは異なる
      console.error(e);
      client.chat.postMessage({
        channel: TEST_CHANNEL_ID,
        text: JSON.stringify(e.message)
      });
      client.reactions.add({
        channel: channelId,
        name: errorReaction,
        timestamp: clockOutMessage.ts
      });
    }
  });
}

const handleSlackEvent = (event: SlackEvent) => {
  console.log(event);
  const client = getSlackClient();
  switch (event.type) {
    case 'message':
      const message = getMessageListener(client, event);
      // TODO: ここではスタンプ押した際に投稿者へのフィードバックを行う。
      message(/:shukkin:|:shussha:|:sagyoukaishi:/, ({ client, event }) => {
        client.chat.postMessage({
          text: '出勤テスト（ephemeralに変更予定）',
          channel: event.channel,
        });
      })

      message(/:taikin:|:saghoushuuryou:|:saishutaikin:/, ({ client, event }) => {
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

const getFreeeEmployeeIdFromSlackUserId = (client: SlackClient, slackUserId: string): number => {
  // TODO: PropertiesService等を挟むようにする（毎回APIを投げない）
  const email = client.users.info({
    user: slackUserId
  }).user.profile.email;
  const employees = getCompanyEmployees();
  const target = employees.filter((employee) => {
    return employee.email === email;
  });
  if (target.length !== 1) {
    throw new Error('duplicate employee email')
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


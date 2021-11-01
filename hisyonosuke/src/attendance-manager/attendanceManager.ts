import { GenericMessageEvent, SlackEvent } from '@slack/bolt';
import { StringIndexed } from '@slack/bolt/dist/types/helpers';
import { GasWebClient as SlackClient } from '@hi-se/web-api';
import { getCompanyEmployees, setTimeClocks } from './freee';

enum IncomingEventType {
  Event,
  Action,
  Command,
  Options,
  ViewAction,
  Shortcut,
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

const handleSlackEvent = (event: SlackEvent) => {
  console.log(event);
  const client = getSlackClient();
  switch (event.type) {
    case 'message':
      const message = getMessageListener(client, event);
      message('test', ({ client, event }) => {
        console.log(event.text);
        // setTimeClocks(0, {
        //   company_id: 0,
        //   type: 'clock_in',
        //   base_date: new Date().toISOString(),
        //   datetime: new Date()

        // })
      });

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


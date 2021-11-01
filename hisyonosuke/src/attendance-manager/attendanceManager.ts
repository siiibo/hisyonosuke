import { GenericMessageEvent, SlackEvent } from '@slack/bolt';
import { StringIndexed } from '@slack/bolt/dist/types/helpers';
import { GasWebClient as SlackClient } from '@hi-se/web-api';
import { setTimeClocks } from './freee';

enum IncomingEventType {
  Event,
  Action,
  Command,
  Options,
  ViewAction,
  Shortcut,
}

const STAMP_NAMES = {
  START: [':shukkin:', ':shussha:', ':sagyoukaishi:'],
  END: [':taikin:', ':saghoushuuryou:', ':saishutaikin:'],
  REMOTE: ['remote', ':remoteshukkin:']
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
      message('test', (client, event) => {
        console.log(event.text);
        // setTimeClocks(0, {
        //   company_id: 0,
        //   type: 'clock_in',
        //   base_date: new Date().toISOString(),
        //   datetime: new Date()

        // })
      });

      message(':remote:', (client, event) => {
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
      return (commandRegExpString: string, callback: (client: SlackClient, event: GenericMessageEvent) => void) => {
        if (isOriginalCommand((event as GenericMessageEvent).text, commandRegExpString)) {
          callback(client, event as GenericMessageEvent);
        }
      }
    }
  }
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


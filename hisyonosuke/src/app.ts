// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck //FIXME: strict modeの影響を避けている。次本ファイルを修正する際にこのコメントを解消する
import {
  ChannelCreatedEvent,
  EmojiChangedEvent,
  SlackAction,
  SlackEvent,
  SlackShortcut,
  SlackViewAction,
} from "@slack/bolt";
import { GasWebClient as SlackClient } from "@hi-se/web-api";
import { birthdayRegistrator } from "./birthday-registrator/birthday-registrator";
import { workflowCustomStep } from "./workflow-customstep/workflow-customstep";

const PROPS_SPREADSHEET_ID = "1Kuq2VaGe96zn0G3LG7OxapLZ0aQvYMqOW9IlorwbJoU";

// Shujinosukeから移行 // TODO: いつか全体を整えたらコメント消す
const EMOJI_EVENT_POST_CHANNEL = "C011BG29K71"; // #雑談
const CHANNEL_EVENT_POST_CHANNEL = "C011BG29K71"; // #雑談

export const init = () => {
  initProperties();
  initAttendanceManager();
};

const initProperties = () => {
  const sheet = SpreadsheetApp.openById(PROPS_SPREADSHEET_ID).getSheetByName("CONFIG");
  const rows = sheet.getDataRange().getValues();
  const properties = {};
  for (const row of rows.slice(1)) properties[row[0]] = row[1];

  const scriptProperties = PropertiesService.getScriptProperties();

  // TODO: 削除するpropertyを限定するか、各プロジェクトごとにinit処理を明示し、他プロジェクトに影響されないようにする
  // scriptProperties.deleteAllProperties();

  scriptProperties.setProperties(properties);
};

export const doPost = (e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput => {
  console.info({
    appName: "hisyonoske",
    ...e,
  });

  if (isUrlVerification(e)) {
    return ContentService.createTextOutput(JSON.parse(e.postData.contents)["challenge"]);
  }

  // Shujinosukeから移行 // TODO: いつか全体を整えたらコメント消す
  if (isEvent(e)) {
    const event = JSON.parse(e.postData.contents)["event"] as SlackEvent;
    const client = getSlackClient();
    if (event.type === "app_mention") {
      if (isOriginalCommand(event.text, "アルバイトシフト")) {
        const calendarId = "c_1889m1jd2rticjeig08cshi84mnrs4gaedkmiqb2dsn66rrd@resource.calendar.google.com";
        const calendar = CalendarApp.getCalendarById(calendarId);
        const targetDate = new Date();
        const dailyShifts = calendar.getEventsForDay(targetDate);

        if (!dailyShifts.length) {
          client.chat.postMessage({
            channel: event.channel,
            text: "今日の予定はありません",
          });
          return;
        }

        const notificationString =
          dailyShifts
            .map((dailyShift) => {
              const title = dailyShift.getTitle();
              const startTime = Utilities.formatDate(dailyShift.getStartTime(), "Asia/Tokyo", "HH:mm");
              const endTime = Utilities.formatDate(dailyShift.getEndTime(), "Asia/Tokyo", "HH:mm");
              return `${title}  ${startTime} 〜 ${endTime}`;
            })
            .join("\n") +
          "\n\n" +
          ":calendar: 勤務開始時に<https://calendar.google.com/calendar|カレンダー>に予定が入っていないか確認しましょう！";

        client.chat.postMessage({
          channel: event.channel,
          text: notificationString,
        });
      }
    }
    if (event.type === "emoji_changed") {
      handleEmojiChange(client, event as EmojiChangedEvent);
    }
    if (event.type === "channel_created") {
      handleChannelCreated(client, event as ChannelCreatedEvent);
    }
  }
  if (isShiftChange(e)){
    shiftChange(e);
  }
  const response = birthdayRegistrator(e); // FIXME: レスポンスの書き換えが生じないようにとりあえずconstで定義してある
  workflowCustomStep(e);

  return ContentService.createTextOutput(response).setMimeType(ContentService.MimeType.JSON);
};

// attendanceManager.ts から移行 // TODO: いつか全体を整えたらコメント消す
const getSlackClient = () => {
  const token = PropertiesService.getScriptProperties().getProperty("SLACK_TOKEN");
  return new SlackClient(token);
};

const isJson = (e: GoogleAppsScript.Events.DoPost): boolean => {
  return e.postData.type === "application/json";
};

const isUrlVerification = (e: GoogleAppsScript.Events.DoPost): boolean => {
  if (isJson(e) && e.postData.contents) {
    return JSON.parse(e.postData.contents).type === "url_verification";
  } else {
    return false;
  }
};

const isAction = (e: GoogleAppsScript.Events.DoPost): boolean => {
  if ("payload" in e.parameter) {
    const type = JSON.parse(e.parameter["payload"])["type"];
    return type === "block_actions" || type === "workflow_step_edit";
  }
  return false;
};

const isViewAction = (e: GoogleAppsScript.Events.DoPost): boolean => {
  if (e.parameter.payload) {
    const type = JSON.parse(e.parameter["payload"])["type"];
    return type === "view_submission" || type === "view_closed";
  }
  return false;
};

const isShortcut = (e: GoogleAppsScript.Events.DoPost): boolean => {
  if ("payload" in e.parameter) {
    const type = JSON.parse(e.parameter["payload"])["type"];
    return type === "shortcut";
  }
  return false;
};

const isEvent = (e: GoogleAppsScript.Events.DoPost): boolean => {
  if (isJson(e) && e.postData.contents) {
    return "event" in JSON.parse(e.postData.contents);
  }
  return false;
};

const isShiftChange = (e: GoogleAppsScript.Events.DoPost): boolean => {
  if (e.parameter.command === '/bot-test');
}

export const getTypeAndCallbackId = (e: GoogleAppsScript.Events.DoPost): { type: string; callback_id: string } => {
  // FIXME: この関数は使わない方向に修正していく
  // 詳細は https://github.com/siiibo/hisyonosuke/pull/1 参照
  if (isAction(e)) {
    const payload = JSON.parse(e.parameter["payload"]) as SlackAction;
    switch (payload.type) {
      case "block_actions":
        return { type: payload.type, callback_id: payload.view.callback_id };
      case "workflow_step_edit":
        return { type: payload.type, callback_id: payload.callback_id };
      default:
        return { type: payload.type, callback_id: undefined };
    }
  } else if (isViewAction(e)) {
    const payload = JSON.parse(e.parameter["payload"]) as SlackViewAction;
    switch (payload.type) {
      case "view_submission":
        return { type: payload.type, callback_id: payload.view.callback_id };
      case "view_closed":
        return { type: payload.type, callback_id: payload.view.callback_id };
    }
  } else if (isShortcut(e)) {
    const payload = JSON.parse(e.parameter["payload"]) as SlackShortcut;
    switch (payload.type) {
      case "shortcut":
        return { type: payload.type, callback_id: payload.callback_id };
      case "message_action":
        return { type: payload.type, callback_id: payload.callback_id };
    }
  } else if (isEvent(e)) {
    const payload = JSON.parse(e.postData.contents).event as SlackEvent;
    switch (payload.type) {
      case "workflow_step_execute":
        return { type: payload.type, callback_id: payload.callback_id };
      default:
        return { type: payload.type, callback_id: undefined };
    }
  }
};

// Shujinosukeから移行 // TODO: いつか全体を整えたらコメント消す
const isOriginalCommand = (target: string, commandRegExpString: string) => {
  const regExpString = {
    slackMarkUp: "([*_~`>]|`{3,})*",
    slackMention: "<@\\w+[\\w\\s|]*>\\s+",
    commandEnd: "($|[\\s.]+)", // SlackBotのリマインダーで英字コマンドを呼び出すと文末にピリオド(.)が追加される
  };
  const commandRegExp = new RegExp(
    regExpString.slackMention +
      regExpString.slackMarkUp +
      commandRegExpString +
      regExpString.slackMarkUp +
      regExpString.commandEnd
  );
  return target.match(commandRegExp);
};
const handleEmojiChange = (client: SlackClient, event: EmojiChangedEvent) => {
  if (event.subtype === "add") {
    client.chat.postMessage({
      channel: EMOJI_EVENT_POST_CHANNEL,
      text: `:${event.name}:  (\`:${event.name}:\`)が追加されました！`,
    });
  }
};

const handleChannelCreated = (client: SlackClient, event: ChannelCreatedEvent) => {
  client.chat.postMessage({
    channel: CHANNEL_EVENT_POST_CHANNEL,
    text: `<#${event.channel.id}>が追加されました！`,
  });
}

const init = () => {
  initProperties();
  initAttendanceManager();
}

const initProperties = () => {
  const sheet = SpreadsheetApp.openById(PROPS_SPREADSHEET_ID).getSheetByName('CONFIG');
  const rows = sheet.getDataRange().getValues();
  const properties = {};
  for (const row of rows.slice(1)) properties[row[0]] = row[1];

  const scriptProperties = PropertiesService.getScriptProperties();

  // TODO: 削除するpropertyを限定するか、各プロジェクトごとにinit処理を明示し、他プロジェクトに影響されないようにする
  // scriptProperties.deleteAllProperties();

  scriptProperties.setProperties(properties);
}

declare const global: any;
global.doPost = doPost;
global.init = init;
global.notificator = notificator;
global.periodicallyCheckForAttendanceManager = periodicallyCheckForAttendanceManager;

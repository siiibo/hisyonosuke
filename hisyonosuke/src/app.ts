// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck //FIXME: strict modeの影響を避けている。次本ファイルを修正する際にこのコメントを解消する
import { ChannelCreatedEvent, SlackEvent } from "@slack/bolt";
import { GasWebClient as SlackClient } from "@hi-se/web-api";
import { initAttendanceManager } from "./attendance-manager/attendanceManager";
import { shiftChanger } from "./shift-changer/shift-changer-api";

const PROPS_SPREADSHEET_ID = "1Kuq2VaGe96zn0G3LG7OxapLZ0aQvYMqOW9IlorwbJoU";

// Shujinosukeから移行 // TODO: いつか全体を整えたらコメント消す
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
    if (event.type === "channel_created") {
      handleChannelCreated(client, event as ChannelCreatedEvent);
    }
  }

  if (e.parameter.apiId === "shift-changer") {
    const response = shiftChanger(e);
    return ContentService.createTextOutput(response).setMimeType(ContentService.MimeType.JSON);
  }

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

const isEvent = (e: GoogleAppsScript.Events.DoPost): boolean => {
  if (isJson(e) && e.postData.contents) {
    return "event" in JSON.parse(e.postData.contents);
  }
  return false;
};

const handleChannelCreated = (client: SlackClient, event: ChannelCreatedEvent) => {
  client.chat.postMessage({
    channel: CHANNEL_EVENT_POST_CHANNEL,
    text: `<#${event.channel.id}>が追加されました！`,
  });
};

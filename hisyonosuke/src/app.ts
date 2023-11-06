// eslint-disable-next-line @typescript-eslint/ban-ts-comment
import { ChannelCreatedEvent, SlackEvent } from "@slack/bolt";
import { GasWebClient as SlackClient } from "@hi-se/web-api";
import { initAttendanceManager } from "./attendance-manager/attendanceManager";
import { shiftChanger } from "./shift-changer/shift-changer-api";

export const init = () => {
  initAttendanceManager();
};

export const doPost = (e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput => {
  console.info({
    appName: "hisyonoske",
    ...e,
  });
  if (isUrlVerification(e)) {
    return ContentService.createTextOutput(JSON.parse(e.postData.contents)["challenge"]);
  }

  if (isEvent(e)) {
    const event = JSON.parse(e.postData.contents)["event"] as SlackEvent;
    const client = getSlackClient();
    if (event.type === "channel_created") {
      handleChannelCreated(client, event as ChannelCreatedEvent);
    }
  }

  if (e.parameter.apiId === "shift-changer") {
    const response = shiftChanger(e) ?? "";
    return ContentService.createTextOutput(response).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.JSON);
};

const getSlackClient = () => {
  const token = PropertiesService.getScriptProperties().getProperty("SLACK_TOKEN");
  if (!token) {
    throw new Error("SLACK_TOKEN is not set");
  }
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
  const CHANNEL_EVENT_POST_CHANNEL = "C011BG29K71"; // #雑談
  client.chat.postMessage({
    channel: CHANNEL_EVENT_POST_CHANNEL,
    text: `<#${event.channel.id}>が追加されました！`,
  });
};

import { GasWebClient as SlackClient } from "@hi-se/web-api";
import { format, set } from "date-fns";
import { Freee } from "./freee";
import { getConfig } from "./config";
import { getCategorizedDailyMessages } from "./message";
import { getUserWorkStatusesByMessages } from "./userWorkStatus";
import { getFreeeEmployeeIdFromSlackUserId } from "./attendanceManager";

const DATE_START_HOUR = 4;

export function initAutoClockOut() {
  const targetFunction = manageForgottenClockOut;
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === targetFunction.name) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger(targetFunction.name).timeBased().atHour(4).everyDays(1).create();
}

export function manageForgottenClockOut() {
  const client = getSlackClient();

  const { CHANNEL_IDS, BOT_USER_ID } = getConfig();

  // チャンネルごとに関数自体を分けて別プロセス（別のタイムトリガー）で動かすように変更する可能性あり
  CHANNEL_IDS.forEach((channelId) => {
    autoCheckAndClockOut(client, channelId, BOT_USER_ID);
  });
}
function autoCheckAndClockOut(client: SlackClient, channelId: string, botUserId: string) {
  const daysToShift = 1;
  const { processedMessages, unprocessedMessages } = getCategorizedDailyMessages(
    client,
    channelId,
    botUserId,
    DATE_START_HOUR,
    daysToShift
  );
  if (!unprocessedMessages.length && !processedMessages.length) return;

  const userWorkStatuses = getUserWorkStatusesByMessages(processedMessages);
  const slackIDs: string[] = [];
  const freee = new Freee();
  const { FREEE_COMPANY_ID } = getConfig();
  Object.keys(userWorkStatuses).forEach((slackID) => {
    const userStatus = userWorkStatuses[slackID];
    console.log("slackID:", slackID, "User Status:", userStatus);
    if (userStatus?.workStatus !== "退勤済み") {
      slackIDs.push(slackID);
      const employeeId = getFreeeEmployeeIdFromSlackUserId(client, freee, slackID, FREEE_COMPANY_ID);
      if (typeof employeeId === "string") throw new Error(employeeId);
      const clockInParams = {
        company_id: FREEE_COMPANY_ID,
        type: "clock_out" as const,
        base_date: format(new Date(), "yyyy-MM-dd"),
        datetime: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
      };
      freee.setTimeClocks(Number(employeeId), clockInParams);
    }
  });
  if (slackIDs.length === 0) return;
  const message = `<@${slackIDs.join(
    ">, <@"
  )}>\n未退勤だったため自動退勤を行いました。freeeにログインして修正してください`;
  console.log(message);
  const timeToPost = set(new Date(), { hours: 9, minutes: 0, seconds: 0 });
  const response = client.chat.scheduleMessage({
    channel: channelId,
    text: message,
    post_at: getUnixTimeStampFromDate(timeToPost),
  });
  if (!response.ok) {
    throw new Error(response.error);
  }
}
const getUnixTimeStampFromDate = (date: Date): number => {
  return Math.floor(date.getTime() / 1000);
};
function getSlackClient() {
  const token = PropertiesService.getScriptProperties().getProperty("SLACK_TOKEN");
  if (!token) {
    throw Error("SLACK_TOKEN is undefined.");
  }
  return new SlackClient(token);
}

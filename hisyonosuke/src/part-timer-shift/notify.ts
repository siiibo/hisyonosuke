import { set } from "date-fns";
import { GasWebClient as SlackClient } from "@hi-se/web-api";

const ANNOUNCE_HOUR = 9;

export function init() {
  const targetFunction = notifyPartTimerShift;

  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === targetFunction.name) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger(targetFunction.name)
    .timeBased()
    .atHour(ANNOUNCE_HOUR - 1)
    .everyDays(1)
    .create();
}

export function notifyPartTimerShift() {
  const client = getSlackClient();
  const announceChannel = "C018XK4E9CG"; // #part-timer

  const calendarId = "c_1889m1jd2rticjeig08cshi84mnrs4gaedkmiqb2dsn66rrd@resource.calendar.google.com";
  const calendar = CalendarApp.getCalendarById(calendarId);

  const now = new Date();
  if (!checkTime(now)) throw new Error(`設定時刻に誤りがあります.\nANNOUNCE_HOUR: ${ANNOUNCE_HOUR}\nnow: ${now}`);

  const targetDate = new Date();
  const announceTime = set(targetDate, { hours: ANNOUNCE_HOUR, minutes: 0, seconds: 0, milliseconds: 0 });
  const dailyShifts = calendar.getEventsForDay(targetDate);
  const notificationString = getNotificationString(dailyShifts);

  client.chat.scheduleMessage({
    channel: announceChannel,
    post_at: getUnixTimeStampString(announceTime),
    text: notificationString,
  });
}

function getNotificationString(events: GoogleAppsScript.Calendar.CalendarEvent[]): string {
  return !events.length
    ? "今日の予定はありません"
    : events.map(getNotificationStringForEvent).join("\n") +
        "\n\n" +
        ":calendar: 勤務開始時に<https://calendar.google.com/calendar|カレンダー>に予定が入っていないか確認しましょう！";
}

function getNotificationStringForEvent(event: GoogleAppsScript.Calendar.CalendarEvent): string {
  const title = event.getTitle();
  const startTime = Utilities.formatDate(event.getStartTime(), "Asia/Tokyo", "HH:mm");
  const endTime = Utilities.formatDate(event.getEndTime(), "Asia/Tokyo", "HH:mm");
  return `${title}  ${startTime} 〜 ${endTime}`;
}

function checkTime(target: Date) {
  return target.getHours() === ANNOUNCE_HOUR - 1;
}

function getUnixTimeStampString(date: Date): string {
  return Math.floor(date.getTime() / 1000).toFixed();
}

function getSlackClient() {
  const token = PropertiesService.getScriptProperties().getProperty("SLACK_TOKEN");
  if (!token) throw new Error("SLACK_TOKEN is not set");
  return new SlackClient(token);
}
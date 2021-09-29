import { getUserIdByEmail, sendMessage, sendScheduleMessage } from './slack'

const CHECK_APP_STATUS_TIME = 9;
const NOTIFICATION_MINUTES_BEFORE = 10;
const PROPS_SPREADSHEET_ID = '1h5lYYicFNSK041zNO90zNB-lZgFPe_c5Suap50ucixc';
const PROPS_SHEET_NAME = 'meeting-notifier';

const ADMIN_SLACK_ID = PropertiesService.getScriptProperties().getProperty('ADMIN_SLACK_ID');

interface NotificationTargetInfo {
  calendar: GoogleAppsScript.Calendar.Calendar,
  event: GoogleAppsScript.Calendar.CalendarEvent,
  guest: GoogleAppsScript.Calendar.EventGuest
}

function getJustTime() {
  let time = new Date();
  time.setHours(time.getHours());
  time.setMinutes(0);
  time.setSeconds(0);
  time.setMilliseconds(0);
  return time;
}

function getNextJustTime() {
  let time = new Date();
  time.setHours(time.getHours() + 1);
  time.setMinutes(0);
  time.setSeconds(0);
  time.setMilliseconds(0);
  return time;
}

function getUnixTimeStampString(date: Date): string {
  return Math.floor(date.getTime() / 1000).toFixed();
}

function getNotificationTime(event: GoogleAppsScript.Calendar.CalendarEvent): Date {
  return new Date(event.getEndTime().getTime() - 1000 * 60 * NOTIFICATION_MINUTES_BEFORE);
}

function setTimeBasedTrigger(triggerFunc: Function, time: Date) {
  console.info(`trigger was set. \nfunction: ${triggerFunc.name}`)
  ScriptApp.newTrigger(triggerFunc.name)
    .timeBased()
    .at(time)
    .create();
}

function deleteTriggerAll() {
  ScriptApp.getProjectTriggers().forEach(trigger => {
    ScriptApp.deleteTrigger(trigger);
  });
}

function checkAppStatus() {
  sendMessage({
    channel: ADMIN_SLACK_ID,
    text: `app status: OK \napp name: MeetingNotifier`
  });
}

function getEventsForHours(calendar: GoogleAppsScript.Calendar.Calendar) {
  return calendar.getEvents(getJustTime(), getNextJustTime());
}

function getTargetCalendars(): GoogleAppsScript.Calendar.Calendar[] {
  const scriptProperties = PropertiesService.getScriptProperties().getProperties();
  const calendars = Object.keys(scriptProperties).filter(key => {
    return key.includes('CALENDAR_ID')
  }).map(calendarId => {
    return CalendarApp.getCalendarById(scriptProperties[calendarId]);
  })

  return calendars;
}

function getEventsForNotification(
  calendar: GoogleAppsScript.Calendar.Calendar
): GoogleAppsScript.Calendar.CalendarEvent[] {
  return getEventsForHours(calendar).filter(event => {
    return needNotification(event);
  });
}

function isResourceCalendar(email: string): boolean {
  return email.indexOf('@resource.calendar.google.com') !== -1;
}

function needNotification(event: GoogleAppsScript.Calendar.CalendarEvent): boolean {
  const now = new Date();
  const nextJustTime = getNextJustTime();
  const endTime = event.getEndTime();
  const notificationTime = getNotificationTime(event);

  return now.getTime() <= notificationTime.getTime() && endTime.getTime() <= nextJustTime.getTime();
}

function setScriptPropertyFromSpreadsheet(sheet: GoogleAppsScript.Spreadsheet.Sheet) {
  const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2);
  const propertiesService = PropertiesService.getScriptProperties();
  range.getValues().map(rowValue => {
    const [key, value] = rowValue;
    propertiesService.setProperty(key, value);
  });
}

function init(): void {
  deleteTriggerAll();
  PropertiesService.getScriptProperties().deleteAllProperties();

  const sheet = SpreadsheetApp.openById(PROPS_SPREADSHEET_ID).getSheetByName(PROPS_SHEET_NAME);
  setScriptPropertyFromSpreadsheet(sheet);
  const calendars = getTargetCalendars();
  setNotificationMessage();
  setTimeBasedTrigger(hourlyCheck, getNextJustTime());
}

function hourlyCheck(): void {
  try {
    if ((new Date).getHours() === CHECK_APP_STATUS_TIME) {
      checkAppStatus();
    }
    deleteTriggerAll();
    const calendars = getTargetCalendars();
    setNotificationMessage();
  } catch (error) {
    sendMessage({
      channel: ADMIN_SLACK_ID,
      text: error
    })
  } finally {
    setTimeBasedTrigger(hourlyCheck, getNextJustTime());
  }
}

function getNotificationTargetInfos(): NotificationTargetInfo[] {
  const calendars = getTargetCalendars();
  const notificationTargetInfos = calendars.flatMap(calendar => {
    const events = getEventsForNotification(calendar);
    return events.flatMap(event => {
      const guests = event.getGuestList(true);
      return guests.flatMap(guest => {
        return {
          calendar: calendar,
          event: event,
          guest: guest
        }
      })
    })
  });
  return notificationTargetInfos;
}

function setNotificationMessage(): void {
  const notificationTargetInfos = getNotificationTargetInfos();
  notificationTargetInfos.forEach(({ calendar, event, guest }) => {
    if (isResourceCalendar(guest.getEmail())) { return; }
    const notificationTime = getNotificationTime(event);
    console.info(
      `calendar: ${calendar.getName()}\n` +
      `event id: ${event.getId()}\n` +
      `event title: ${event.getTitle()}\n` +
      `guest: ${guest.getEmail()}\n` +
      `endTime: ${event.getEndTime()}\n` +
      `notificationTime: ${notificationTime}`
    );
    const userId = getUserIdByEmail({
      email: guest.getEmail()
    });
    sendScheduleMessage({
      channel: userId,
      post_at: getUnixTimeStampString(notificationTime),
      text: `会議終了予定時刻の10分前です.     《 ${event.getTitle()} 》\n`
    })
  })
}

declare const global: any;
global.init = init;
global.hourlyCheck = hourlyCheck;

import { GasWebClient as SlackClient } from '@hi-se/web-api';

const DATE_COL = 3;
const PAYDAY = 25;

export const notificator = () => {
  const prop = PropertiesService.getScriptProperties().getProperties();
  const spreadsheet = SpreadsheetApp.openById(prop.BIRTHDAY_SPREADSHEET_ID);

  notifyAnniversary(spreadsheet);
  notifyPayday(spreadsheet);
}

const notifyAnniversary = (spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet) => {
  const dataSheet = spreadsheet.getSheets()[0];
  const configSheet = spreadsheet.getSheets()[1];
  const todayDate = new Date();

  let defaultMessage: { [key: string]: string; } = {};
  for (let row of configSheet.getDataRange().getValues().slice(1)) {
    defaultMessage[row[0]] = row[1];
  }

  const textFinder = dataSheet.createTextFinder(Utilities.formatDate(todayDate, 'Asia/Tokyo', 'MM/dd'))
    .matchEntireCell(false);

  const ranges = textFinder.findAll();

  for (let range of ranges) {
    const row = range.getRow();
    const [_, type, date, name, message] = dataSheet.getRange(row, 1, 1, 5).getValues()[0];

    if (range.getColumn() == DATE_COL) {
      if (!isNaN(Date.parse(date)) && isMatch(todayDate, date)) {
        const postMessage = createMessage(name, date, todayDate, defaultMessage[type] + '\n' + message);
        postSlackChannel(postMessage);
      }
    }
  }
}

const isMatch = (anniversaryDate: Date, todayDate: Date): boolean => {
  if (todayDate.getMonth() === anniversaryDate.getMonth() && todayDate.getDate() === anniversaryDate.getDate()) {
    return true;
  }
  return false;
}

const createMessage = (name: string, date: Date, current: Date, message: string): string => {
  const years = String(current.getFullYear() - date.getFullYear());
  return message.replace(/NAME/g, name).replace(/YEARS/g, years);
}

const notifyPayday = (spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet) => {
  const configSheet = spreadsheet.getSheets()[1];

  let defaultMessage: { [key: string]: string; } = {};
  for (let row of configSheet.getDataRange().getValues().slice(1)) {
    defaultMessage[row[0]] = row[1];
  }
  if (isPayday()) {
    postSlackChannel(defaultMessage['給料日']);
  }
}

const isPayday = (): boolean => {
  let date = new Date();
  if (!isHoliday(date)) {
    if (date.getDate() == PAYDAY) {
      return true;
    } else {
      for (date.setDate(date.getDate() + 1); isHoliday(date); date.setDate(date.getDate() + 1)) {
        if (date.getDate() == PAYDAY) {
          return true;
        }
      }
    }
  }
  return false;
}

const isHoliday = (date: Date): boolean => {
  const dayOfWeek = date.getDay();
  if (dayOfWeek <= 0 || 6 <= dayOfWeek) {
    return true;
  }

  const calendarId = "ja.japanese#holiday@group.v.calendar.google.com";
  const calendar = CalendarApp.getCalendarById(calendarId);
  const todayEvents = calendar.getEventsForDay(date);
  if (todayEvents.length > 0) {
    return true;
  }
  return false;
}

const getSlackClient = (): SlackClient => {
  const token: string = PropertiesService.getScriptProperties().getProperty('SLACK_TOKEN');
  return new SlackClient(token);
}

const postSlackChannel = (message: string) => {
  const client = getSlackClient();
  const prop = PropertiesService.getScriptProperties().getProperties();
  const result = client.chat.postMessage(
    {
      channel: prop.POST_CHANNEL_ID,
      text: message,
    }
  );
}

import { GasWebClient as SlackClient } from "@hi-se/web-api";
import { format, addWeeks } from "date-fns";
import { calendarFormat } from "moment";
// import { doPost } from "../app";

type OperationType = "registration" | "modificationAndDeletion" | "showEvents";
// export const init = () => {
//   // const spreadsheet = getSpreadsheet();
//   const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
//   ScriptApp.newTrigger(onOpen.name).forSpreadsheet(spreadsheet).onOpen().create();
// };

export const onOpen = () => {
  const ui = SpreadsheetApp.getUi();

  ui.createAddonMenu()
    .addSubMenu(
      ui
        .createMenu("登録")
        .addItem("シートの追加", insertRegistrationSheet.name)
        .addSeparator()
        .addItem("提出", callRegistration.name)
    )
    .addSubMenu(
      ui
        .createMenu("変更・削除")
        .addItem("シートの追加", insertModificationAndDeletionSheet.name)
        .addSeparator()
        .addItem("予定を表示", callShowEvents.name)
        .addItem("提出", callModificationAndDeletion.name)
    )
    .addToUi();
};

export const insertRegistrationSheet = () => {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const today = format(new Date(), "yyyy-MM-dd");
  const sheet = spreadsheet.insertSheet(`${today}-登録`, 0);

  // 内容の設定
  const header = [["日付", "開始時刻", "終了時刻", "休憩開始時刻", "休憩終了時刻", "勤務形態"]];
  sheet.getRange(1, 1, 1, header[0].length).setValues(header).setFontWeight("bold");

  // 入力規則の設定
  const cells1 = sheet.getRange("F2:F1000");
  const rule1 = SpreadsheetApp.newDataValidation()
    .requireValueInList(["リモート", "出社"], true)
    .setAllowInvalid(false)
    .setHelpText("リモート/出社 を選択してください。")
    .build();
  cells1.setDataValidation(rule1);
  const cells2 = sheet.getRange("A2:A1000");
  const rule2 = SpreadsheetApp.newDataValidation()
    .requireDateOnOrAfter(new Date())
    .setAllowInvalid(false)
    .setHelpText("本日以降の日付を入力してください。")
    .build();
  cells2.setDataValidation(rule2);
  const cells3 = sheet.getRange("B2:E1000");
  const rule3 = SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied("=ISDATE(B2)")
    .setHelpText('時刻を"◯◯:◯◯"の形式で入力してください。')
    .build();
  cells3.setDataValidation(rule3);
};

export const insertModificationAndDeletionSheet = () => {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const today = format(new Date(), "yyyy-MM-dd");
  const sheet = spreadsheet.insertSheet(`${today}-変更・削除`, 0);

  // 内容の設定
  const discription1 = "本日以降の日付を入力してください。指定した日付から一週間後までの予定が表示されます。";
  const discription2 = "【予定一覧】";
  const discription3 = "【変更】変更後の予定を記入してください ";
  const discription4 = "【削除】削除したい予定を選択してください";

  const header = [
    [
      "イベント名",
      "日付",
      "開始時刻",
      "終了時刻",
      "日付",
      "開始時刻",
      "終了時刻",
      "休憩開始時刻",
      "休憩終了時刻",
      "勤務形態",
      "削除対象",
    ],
  ];
  sheet.getRange("A1").setValue(discription1).setFontWeight("bold");
  sheet.getRange("A4").setValue(discription2).setFontWeight("bold");
  sheet.getRange("E4").setValue(discription3).setFontWeight("bold");
  sheet.getRange("K4").setValue(discription4).setFontWeight("bold");
  sheet.getRange(5, 1, 1, header[0].length).setValues(header).setFontWeight("bold");

  // 入力規則の設定
  const cells1 = sheet.getRange("A2");
  const cells2 = sheet.getRange("E6:E1000");
  const rule1 = SpreadsheetApp.newDataValidation()
    .requireDateOnOrAfter(new Date())
    .setAllowInvalid(false)
    .setHelpText("本日以降の日付を入力してください。")
    .build();
  cells1.setDataValidation(rule1);
  cells2.setDataValidation(rule1);
  const cells3 = sheet.getRange("F6:I1000");
  const rule3 = SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied("=ISDATE(F6)")
    .setAllowInvalid(false)
    .setHelpText('時刻を"◯◯:◯◯"の形式で入力してください。')
    .build();
  cells3.setDataValidation(rule3);
  const cells4 = sheet.getRange("J6:J1000");
  const rule4 = SpreadsheetApp.newDataValidation()
    .requireValueInList(["リモート", "出社"], true)
    .setAllowInvalid(false)
    .setHelpText("リモート/出社 を選択してください。")
    .build();
  cells4.setDataValidation(rule4);
  const cells5 = sheet.getRange("K6:K1000");
  const rule5 = SpreadsheetApp.newDataValidation()
    .requireCheckbox()
    .setAllowInvalid(false)
    .setHelpText("チェックボックス以外の入力形式は認められません。")
    .build();
  cells5.setDataValidation(rule5);

  // const cells6 = sheet.getRange("E6:J991");
  // const rule6 = SpreadsheetApp.newDataValidation()
  //   .requireFormulaSatisfied("=IF(COUNTA(E6:J6)>0, K6=FALSE )")
  //   .setAllowInvalid(false)
  //   .setHelpText("変更後の予定の記入と、削除対象の選択を同時に行うことはできません。")
  //   .build();
  // cells6.setDataValidation(rule6);
};
export const callRegistration = () => {
  const userEmail = Session.getActiveUser().getEmail();
  const spreadsheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  const payload = {
    operationType: "registration",
    userEmail: userEmail,
    spreadsheetUrl: spreadsheetUrl,
  };
  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "post",
    payload: payload,
  };
  const url = PropertiesService.getScriptProperties().getProperty("API_URL");
  if (!url) throw new Error("API_URL is not defined");
  UrlFetchApp.fetch(url, options);
};

export const callModificationAndDeletion = () => {
  const userEmail = Session.getActiveUser().getEmail();
  const spreadsheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  const payload = {
    operationType: "modificationAndDeletion",
    userEmail: userEmail,
    spreadsheetUrl: spreadsheetUrl,
  };
  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "post",
    payload: payload,
  };
  const url = PropertiesService.getScriptProperties().getProperty("API_URL");
  if (!url) throw new Error("API_URL is not defined");
  UrlFetchApp.fetch(url, options);
};

export const callShowEvents = () => {
  const userEmail = Session.getActiveUser().getEmail();
  const spreadsheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  const payload = {
    operationType: "showEvents",
    userEmail: userEmail,
    spreadsheetUrl: spreadsheetUrl,
  };
  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "post",
    payload: payload,
  };
  const url = PropertiesService.getScriptProperties().getProperty("API_URL");
  if (!url) throw new Error("API_URL is not defined");
  UrlFetchApp.fetch(url, options);
};

export const doPost = (e: GoogleAppsScript.Events.DoPost) => {
  const operationType = e.parameter.operationType;
  const userEmail = e.parameter.userEmail;
  const spreadsheetUrl = e.parameter.spreadsheetUrl;
  switch (operationType) {
    case "registration": {
      registration(operationType, userEmail, spreadsheetUrl);
      break;
    }
    case "modificationAndDeletion": {
      modificationAndDeletion(operationType, userEmail, spreadsheetUrl);
      break;
    }
    case "showEvents": {
      showEvents(userEmail, spreadsheetUrl);
      break;
    }
  }
};

const getSpreadsheet = () => {
  const spreadsheetUrl =
    "https://docs.google.com/spreadsheets/d/1YsyCYCKTT7tDRazqtYLGVIuegOYRthC4uPuAAPzCU0k/edit#gid=0";
  return SpreadsheetApp.openByUrl(spreadsheetUrl);
};

const registration = (operationType: OperationType, userEmail: string, spreadsheetUrl: string) => {
  const shiftInfos = getShiftInfos(operationType, spreadsheetUrl);
  if (shiftInfos === undefined) return;

  const slackAccessToken = PropertiesService.getScriptProperties().getProperty("SLACK_ACCESS_TOKEN");
  if (!slackAccessToken) throw new Error("SLACK_ACCESS_TOKEN is not defined");
  const client = getSlackClient(slackAccessToken);
  const slackMemberProfiles = getSlackMemberProfiles(client);

  shiftInfos.forEach((shiftInfo) => {
    registerEvent(shiftInfo, userEmail, slackMemberProfiles);
  });
};

const getShiftInfos = (operationType: OperationType, spreadsheetUrl: string) => {
  switch (operationType) {
    case "registration": {
      const sheet = SpreadsheetApp.openByUrl(spreadsheetUrl).getActiveSheet();
      if (!sheet) throw new Error("SHEET is not defined");
      const lastRowNum = sheet.getLastRow();
      const shiftInfos = sheet.getRange(2, 1, lastRowNum - 1, 6).getValues();
      return shiftInfos;
    }

    case "modificationAndDeletion": {
      const sheet = SpreadsheetApp.openByUrl(spreadsheetUrl).getActiveSheet();
      if (!sheet) throw new Error("SHEET is not defined");
      const lastRowNum = sheet.getLastRow();
      const shiftInfos = sheet.getRange(6, 5, lastRowNum - 5, 6).getValues();
      return shiftInfos;
    }
  }
};

const getCalendar = () => {
  const calendarId = PropertiesService.getScriptProperties().getProperty("CALENDAR_ID");
  if (!calendarId) throw new Error("ID is not defined");
  const calendar = CalendarApp.getCalendarById(calendarId);
  return calendar;
};

const getNameFromEmail = (email: string, slackMemberProfiles: { name: string; email: string }[]) => {
  const slackMember = slackMemberProfiles.filter((slackMemberProfile) => slackMemberProfile.email === email);
  // 悩み: emailが一致するフィルターをかければ要素は一個になるはず [0]がマジックナンバーになっている
  return slackMember[0].name;
};

const getSlackMemberProfiles = (client: SlackClient): { name: string; email: string }[] => {
  const response = client.users.list();
  const slackMembers = response.members;
  if (!slackMembers) throw new Error("SLACK_MEMBERS is not defined");

  const siiiboSlackMembers = slackMembers.filter(
    (slackMember) =>
      !slackMember.deleted &&
      !slackMember.is_bot &&
      slackMember.id !== "USLACKBOT" &&
      slackMember.profile?.email?.match("siiibo.com")
  );

  const slackMemberProfiles = siiiboSlackMembers
    .map((slackMember) => {
      return {
        name: slackMember.profile?.real_name,
        email: slackMember.profile?.email,
      };
    })
    .filter((s): s is { name: string; email: string } => s.name !== "" || s.email !== "");
  return slackMemberProfiles;
};

const getSlackClient = (slackToken: string): SlackClient => {
  return new SlackClient(slackToken);
};

const getJob = (name: string): string | undefined => {
  // 人対職種データベース
  const spreadSheetUrl = "https://docs.google.com/spreadsheets/d/1g-n_RL7Rou8chG3n_GOyieBbtPTl6eTkDsGQLRWXKbI/edit";
  const sheet = SpreadsheetApp.openByUrl(spreadSheetUrl).getSheetByName("シート1");
  if (!sheet) throw new Error("SHEET is not defined");
  const lastRowNum = sheet.getLastRow();
  const jobInfos = sheet.getRange(1, 1, lastRowNum, 2).getValues();
  const jobInfo = jobInfos.find((jobInfo) => jobInfo[1] === name);
  if (jobInfo === undefined) return;

  const job = jobInfo[0];
  return job;
};

const getCalendarInfoFromShiftInfo = (
  shiftInfo: any[],
  userEmail: string,
  slackMemberProfiles: {
    name: string;
    email: string;
  }[]
): { title: string; startDate: Date; endDate: Date } => {
  const name = getNameFromEmail(userEmail, slackMemberProfiles);
  const job = getJob(name);

  const date = format(shiftInfo[0], "yyyy-MM-dd");
  const startTime = format(shiftInfo[1], "HH:mm");
  const endTime = format(shiftInfo[2], "HH:mm");
  const workingStyle = shiftInfo[5];
  const startDate = new Date(`${date} ${startTime}`);
  const endDate = new Date(`${date} ${endTime}`);

  if (shiftInfo[3] === "" || shiftInfo[4] === "") {
    const title = `【${workingStyle}】${job}: ${name}さん`;
    return { title: title, startDate: startDate, endDate: endDate };
  } else {
    const restStartTime = format(shiftInfo[3], "HH:mm");

    const restEndTime = format(shiftInfo[4], "HH:mm");

    const title = `【${workingStyle}】${job}: ${name}さん (休憩: ${restStartTime}~${restEndTime})`;
    return { title: title, startDate: startDate, endDate: endDate };
  }
};
const registerEvent = (
  shiftInfo: any[],
  userEmail: string,
  slackMemberProfiles: {
    name: string;
    email: string;
  }[]
) => {
  const registrationInfo = getCalendarInfoFromShiftInfo(shiftInfo, userEmail, slackMemberProfiles);
  const title = registrationInfo.title;
  const startDate = registrationInfo.startDate;
  const endDate = registrationInfo.endDate;
  const calendar = getCalendar();

  calendar.createEvent(title, startDate, endDate, { guests: userEmail });
};
const isEventGuest = (event: GoogleAppsScript.Calendar.CalendarEvent, email: string) => {
  const guestEmails = event.getGuestList().map((guest) => guest.getEmail());
  return guestEmails.indexOf(email) !== -1;
};

const showEvents = (userEmail: string, spreadsheetUrl: string) => {
  const sheet = SpreadsheetApp.openByUrl(spreadsheetUrl).getActiveSheet();
  if (!sheet) throw new Error("SHEET is not defined");
  const startDate = sheet.getRange("A2").getValue();
  const endDate = addWeeks(startDate, 1);
  const calendar = getCalendar();
  const events = calendar.getEvents(startDate, endDate).filter((event) => isEventGuest(event, userEmail));

  if (events.length === 0) {
    return;
  }

  const eventsInfo = events.map((event) => {
    const title = event.getTitle();
    const date = Utilities.formatDate(event.getStartTime(), "JST", "MM/dd");
    const startTime = Utilities.formatDate(event.getStartTime(), "JST", "HH:mm");
    const endTime = Utilities.formatDate(event.getEndTime(), "JST", "HH:mm");
    return [title, date, startTime, endTime];
  });
  sheet.getRange(6, 1, eventsInfo.length, eventsInfo[0].length).setValues(eventsInfo);
  // sheet
  //   .getRange(6, 1 + eventsInfo[0].length, eventsInfo.length, 1)
  //   .insertCheckboxes()
  //   .uncheck();
};

const modificationAndDeletion = (operationType: OperationType, userEmail: string, spreadsheetUrl: string) => {
  modification(operationType, userEmail, spreadsheetUrl);
  deletion(userEmail, spreadsheetUrl);
};
const deletion = (userEmail: string, spreadsheetUrl: string) => {
  // getShiftInfo
  const sheet = SpreadsheetApp.openByUrl(spreadsheetUrl).getActiveSheet();
  if (!sheet) throw new Error("SHEET is not defined");
  const lastRow = sheet.getLastRow();
  const dataRow = lastRow - 6 + 1;
  const dataColumn = sheet.getLastColumn();
  // const lastColumn = sheet.getLastColumn();

  const selectedEventsInfo = sheet
    .getRange(6, 1, dataRow, dataColumn)
    .getValues()
    .filter((event) => event[10]);

  const calendar = getCalendar();
  selectedEventsInfo.forEach((eventInfo) => deleteEvent(eventInfo, calendar, userEmail));
};

const deleteEvent = (eventInfo: Date[], calendar: GoogleAppsScript.Calendar.Calendar, userEmail: string) => {
  const date = format(eventInfo[1], "yyyy-MM-dd");
  const startTime = format(eventInfo[2], "HH:mm");
  const endTime = format(eventInfo[3], "HH:mm");
  const startDate = new Date(`${date} ${startTime}`);
  const endDate = new Date(`${date} ${endTime}`);

  const event = calendar.getEvents(startDate, endDate).find((event) => isEventGuest(event, userEmail));
  if (event === undefined) return;
  event.deleteEvent();
};

const modification = (operationType: OperationType, userEmail: string, spreadsheetUrl: string) => {
  const sheet = SpreadsheetApp.openByUrl(spreadsheetUrl).getActiveSheet();
  if (!sheet) throw new Error("SHEET is not defined");
  const lastRowNum = sheet.getLastRow();
  const selectedEventInfos = sheet
    .getRange(6, 1, lastRowNum - 5, 12)
    .getValues()
    .filter((event) => event[4]);

  const newEventInfos = getShiftInfos(operationType, spreadsheetUrl);
  if (newEventInfos === undefined) return;
  const calendar = getCalendar();

  console.log("selectedEventInfos", selectedEventInfos);
  selectedEventInfos.forEach((eventInfo) => modifyEvent(eventInfo, calendar, userEmail));
};

const modifyEvent = (eventInfo: any[], calendar: GoogleAppsScript.Calendar.Calendar, userEmail: string) => {
  console.log("eventInfo", eventInfo);
  // Emailから名前を取得
  const slackAccessToken = PropertiesService.getScriptProperties().getProperty("SLACK_ACCESS_TOKEN");
  if (!slackAccessToken) throw new Error("SLACK_ACCESS_TOKEN is not defined");
  const client = getSlackClient(slackAccessToken);
  const slackMemberProfiles = getSlackMemberProfiles(client);

  // getPreviousEventInfo
  const previousEventInfo = eventInfo.slice(0, 4);
  const date = format(previousEventInfo[1], "yyyy-MM-dd");
  const startTime = format(previousEventInfo[2], "HH:mm");
  const endTime = format(previousEventInfo[3], "HH:mm");
  const startDate = new Date(`${date} ${startTime}`);
  const endDate = new Date(`${date} ${endTime}`);

  // getNewEventInfo
  const newEventInfo = eventInfo.slice(4, 10);
  const newCalendarInfo = getCalendarInfoFromShiftInfo(newEventInfo, userEmail, slackMemberProfiles);
  const newTitle = newCalendarInfo.title;
  const newStartDate = newCalendarInfo.startDate;
  const newEndDate = newCalendarInfo.endDate;

  const event = calendar.getEvents(startDate, endDate).find((event) => isEventGuest(event, userEmail));
  console.log("event", event);
  if (event === undefined) return;
  event.setTime(newStartDate, newEndDate);

  event.setTitle(newTitle);
};

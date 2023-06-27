import { format } from "date-fns";
import { GasWebClient as SlackClient } from "@hi-se/web-api";
import { getConfig } from "./config";
import { EventInfo } from "./shift-changer-api";

type SheetType = "registration" | "modificationAndDeletion";
type OperationType = "registration" | "modificationAndDeletion" | "showEvents";

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
  sheet.addDeveloperMetadata(`${today}-registration`);

  const header = ["日付", "開始時刻", "終了時刻", "休憩開始時刻", "休憩終了時刻", "勤務形態"];
  sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight("bold");

  const workingStyleCells = sheet.getRange("F2:F1000");
  const workingStyleRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["リモート", "出社"], true)
    .setAllowInvalid(false)
    .setHelpText("リモート/出社 を選択してください。")
    .build();
  workingStyleCells.setDataValidation(workingStyleRule);
  const dateCells = sheet.getRange("A2:A1000");
  const dateRule = SpreadsheetApp.newDataValidation()
    .requireDateOnOrAfter(new Date())
    .setAllowInvalid(false)
    .setHelpText("本日以降の日付を入力してください。")
    .build();
  dateCells.setDataValidation(dateRule);
  const timeCells = sheet.getRange("B2:E1000");
  const timeRule = SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied("=ISDATE(B2)")
    .setHelpText('時刻を"◯◯:◯◯"の形式で入力してください。')
    .build();
  timeCells.setDataValidation(timeRule);
};

export const insertModificationAndDeletionSheet = () => {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const today = format(new Date(), "yyyy-MM-dd");
  const sheet = spreadsheet.insertSheet(`${today}-変更・削除`, 0);
  sheet.addDeveloperMetadata(`${today}-modificationAndDeletion`);

  const description1 = "本日以降の日付を入力してください。指定した日付から一週間後までの予定が表示されます。";
  const description2 = "【予定一覧】";
  const description3 = "【変更】変更後の予定を記入してください ";
  const description4 = "【削除】削除したい予定を選択してください";

  const header = [
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
  ];
  sheet.getRange("A1").setValue(description1).setFontWeight("bold");
  sheet.getRange("A4").setValue(description2).setFontWeight("bold");
  sheet.getRange("E4").setValue(description3).setFontWeight("bold");
  sheet.getRange("K4").setValue(description4).setFontWeight("bold");
  sheet.getRange(5, 1, 1, header.length).setValues([header]).setFontWeight("bold");

  const dateCell = sheet.getRange("A2");
  const dateCells = sheet.getRange("E6:E1000");
  const dateRule = SpreadsheetApp.newDataValidation()
    .requireDateOnOrAfter(new Date())
    .setAllowInvalid(false)
    .setHelpText("本日以降の日付を入力してください。")
    .build();
  dateCell.setDataValidation(dateRule);
  dateCells.setDataValidation(dateRule);
  const timeCells = sheet.getRange("F6:I1000");
  const timeRule = SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied("=ISDATE(F6)")
    .setAllowInvalid(false)
    .setHelpText('時刻を"◯◯:◯◯"の形式で入力してください。\n【例】 9:00')
    .build();
  timeCells.setDataValidation(timeRule);
  const workingStyleCells = sheet.getRange("J6:J1000");
  const workingStyleRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["リモート", "出社"], true)
    .setAllowInvalid(false)
    .setHelpText("リモート/出社 を選択してください。")
    .build();
  workingStyleCells.setDataValidation(workingStyleRule);
  const checkboxCells = sheet.getRange("K6:K1000");
  const checkboxRule = SpreadsheetApp.newDataValidation()
    .requireCheckbox()
    .setAllowInvalid(false)
    .setHelpText("チェックボックス以外の入力形式は認められません。")
    .build();
  checkboxCells.setDataValidation(checkboxRule);

  sheet.setColumnWidth(1, 370);
};
export const callRegistration = () => {
  const userEmail = Session.getActiveUser().getEmail();
  const spreadsheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  const { SLACK_ACCESS_TOKEN } = getConfig();
  const client = getSlackClient(SLACK_ACCESS_TOKEN);
  const slackMemberProfiles = getSlackMemberProfiles(client);

  const sheetType: SheetType = "registration";
  const sheet = getSheet(sheetType, spreadsheetUrl);
  const operationType: OperationType = "registration";
  const registrationInfos = getRegistrationInfos(sheet, userEmail, slackMemberProfiles);

  const payload = {
    apiId: "shift-changer",
    operationType: operationType,
    userEmail: userEmail,
    registrationInfos: JSON.stringify(registrationInfos),
  };
  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "post",
    payload: payload,
  };
  const { API_URL, SLACK_CHANNEL_TO_POST } = getConfig();
  UrlFetchApp.fetch(API_URL, options);
  const messageToNotify = createRegistrationMessage(registrationInfos);
  postMessageToSlackChannel(client, SLACK_CHANNEL_TO_POST, messageToNotify);
};

const getModificationInfos = (
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  userEmail: string,
  slackMemberProfiles: {
    name: string;
    email: string;
  }[]
): {
  previousEventInfo: EventInfo;
  newEventInfo: EventInfo;
}[] => {
  const modificationInfos = sheet
    .getRange(6, 1, sheet.getLastRow() - 5, sheet.getLastColumn())
    .getValues()
    .filter((event) => event[4])
    .map((eventInfo) => {
      const previousEventInfo = eventInfo.slice(0, 4);
      const title = previousEventInfo[0];
      const date = format(previousEventInfo[1], "yyyy-MM-dd");
      const startTime = format(previousEventInfo[2], "HH:mm");
      const endTime = format(previousEventInfo[3], "HH:mm");
      const newEventInfo = eventInfo.slice(4, 10);
      const newDate = format(newEventInfo[0], "yyyy-MM-dd");
      const newStartTime = format(newEventInfo[1], "HH:mm");
      const newEndTime = format(newEventInfo[2], "HH:mm");
      const newRestStartTime = format(newEventInfo[3], "HH:mm");
      const newRestEndTime = format(newEventInfo[4], "HH:mm");
      const newWorkingStyle = newEventInfo[5];
      const newTitle = createTitleFromEventInfo(
        { restStartTime: newRestStartTime, restEndTime: newRestEndTime, workingStyle: newWorkingStyle },
        userEmail,
        slackMemberProfiles
      );
      return {
        previousEventInfo: { title, date, startTime, endTime },
        newEventInfo: { title: newTitle, date: newDate, startTime: newStartTime, endTime: newEndTime },
      };
    });

  return modificationInfos;
};

const getDeletionInfos = (sheet: GoogleAppsScript.Spreadsheet.Sheet): EventInfo[] => {
  const deletionInfos = sheet
    .getRange(6, 1, sheet.getLastRow() - 5, sheet.getLastColumn())
    .getValues()
    .filter((event) => event[10])
    .map((eventInfo) => {
      const title: string = eventInfo[0];
      const date = format(eventInfo[1], "yyyy-MM-dd");
      const startTime = format(eventInfo[2], "HH:mm");
      const endTime = format(eventInfo[3], "HH:mm");
      return { title, date, startTime, endTime };
    });

  return deletionInfos;
};
export const callModificationAndDeletion = () => {
  const userEmail = Session.getActiveUser().getEmail();
  const spreadsheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  const { SLACK_ACCESS_TOKEN } = getConfig();
  const client = getSlackClient(SLACK_ACCESS_TOKEN);
  const slackMemberProfiles = getSlackMemberProfiles(client);
  const sheetType: SheetType = "modificationAndDeletion";
  const sheet = getSheet(sheetType, spreadsheetUrl);
  const operationType: OperationType = "modificationAndDeletion";
  const modificationInfos = getModificationInfos(sheet, userEmail, slackMemberProfiles);
  const deletionInfos = getDeletionInfos(sheet);

  const payload = {
    apiId: "shift-changer",
    operationType: operationType,
    userEmail: userEmail,
    modificationInfos: JSON.stringify(modificationInfos),
    deletionInfos: JSON.stringify(deletionInfos),
  };
  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "post",
    payload: payload,
  };
  const { API_URL, SLACK_CHANNEL_TO_POST } = getConfig();
  UrlFetchApp.fetch(API_URL, options);

  const modificationMessageToNotify = createModificationMessage(modificationInfos);
  if (modificationMessageToNotify)
    postMessageToSlackChannel(client, SLACK_CHANNEL_TO_POST, modificationMessageToNotify);

  const deletionMessageToNotify = createDeletionMessage(deletionInfos);
  if (deletionMessageToNotify) postMessageToSlackChannel(client, SLACK_CHANNEL_TO_POST, deletionMessageToNotify);
};

export const callShowEvents = () => {
  const userEmail = Session.getActiveUser().getEmail();
  const spreadsheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  const sheetType: SheetType = "modificationAndDeletion";
  const sheet = getSheet(sheetType, spreadsheetUrl);
  const operationType: OperationType = "showEvents";
  const startDate = sheet.getRange("A2").getValue();

  sheet.getRange(6, 1, sheet.getLastRow() - 5, sheet.getLastColumn()).clearContent();

  const payload = {
    apiId: "shift-changer",
    operationType: operationType,
    userEmail: userEmail,
    startDate: startDate,
  };
  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "post",
    payload: payload,
  };
  const { API_URL } = getConfig();
  const response = UrlFetchApp.fetch(API_URL, options);
  if (!response.getContentText()) return;

  const eventInfos: EventInfo[] = JSON.parse(response.getContentText());
  const moldedEventInfos = eventInfos.map(({ title, date, startTime, endTime }) => {
    return [title, date, startTime, endTime];
  });

  sheet.getRange(6, 1, moldedEventInfos.length, moldedEventInfos[0].length).setValues(moldedEventInfos);
};

const getSheet = (sheetType: SheetType, spreadsheetUrl: string): GoogleAppsScript.Spreadsheet.Sheet => {
  const today = format(new Date(), "yyyy-MM-dd");
  const sheet = SpreadsheetApp.openByUrl(spreadsheetUrl)
    .getSheets()
    .find((sheet) => sheet.getDeveloperMetadata()[0].getKey() === `${today}-${sheetType}`);

  if (!sheet) throw new Error("SHEET is not defined");

  return sheet;
};

const getRegistrationInfos = (
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  userEmail: string,
  slackMemberProfiles: { name: string; email: string }[]
): EventInfo[] => {
  const registrationInfos = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn())
    .getValues()
    .map((eventInfo) => {
      const date = format(eventInfo[0] as Date, "yyyy-MM-dd");
      const startTime = format(eventInfo[1] as Date, "HH:mm");
      const endTime = format(eventInfo[2] as Date, "HH:mm");
      const restStartTime = format(eventInfo[3] as Date, "HH:mm");
      const restEndTime = format(eventInfo[4] as Date, "HH:mm");
      const workingStyle = eventInfo[5] as string;
      const title = createTitleFromEventInfo(
        { restStartTime, restEndTime, workingStyle },
        userEmail,
        slackMemberProfiles
      );
      return { title, date, startTime, endTime };
    });
  return registrationInfos;
};

const createTitleFromEventInfo = (
  eventInfo: {
    restStartTime: string;
    restEndTime: string;
    workingStyle: string;
  },
  userEmail: string,
  slackMemberProfiles: {
    name: string;
    email: string;
  }[]
): string => {
  const name = getNameFromEmail(userEmail, slackMemberProfiles);
  const nameRegex = new RegExp(name.replace(/ |\u3000/g, "( |\u3000|)?"));
  const job = getJob(nameRegex);

  const restStartTime = eventInfo.restStartTime;
  const restEndTime = eventInfo.restEndTime;
  const workingStyle = eventInfo.workingStyle;

  if (restStartTime === "" || restEndTime === "") {
    const title = `【${workingStyle}】${job}: ${name}さん`;
    return title;
  } else {
    const title = `【${workingStyle}】${job}: ${name}さん (休憩: ${restStartTime}~${restEndTime})`;
    return title;
  }
};

const getNameFromEmail = (email: string, slackMemberProfiles: { name: string; email: string }[]): string => {
  const slackMember = slackMemberProfiles.find((slackMemberProfile) => slackMemberProfile.email === email);
  if (!slackMember) throw new Error("The email is non-slack member");
  return slackMember.name;
};

const getSlackMemberProfiles = (client: SlackClient): { name: string; email: string }[] => {
  const slackMembers = client.users.list().members ?? [];

  const siiiboSlackMembers = slackMembers.filter(
    (slackMember) =>
      !slackMember.deleted &&
      !slackMember.is_bot &&
      slackMember.id !== "USLACKBOT" &&
      slackMember.profile?.email?.includes("siiibo.com")
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

const getJob = (nameRegex: RegExp): string | undefined => {
  const { JOB_SHEET_URL } = getConfig();
  const sheet = SpreadsheetApp.openByUrl(JOB_SHEET_URL).getSheetByName("シート1");
  if (!sheet) throw new Error("SHEET is not defined");
  const jobInfos = sheet.getRange(1, 1, sheet.getLastRow(), 2).getValues();
  const jobInfo = jobInfos.find((jobInfo) => jobInfo[1].match(nameRegex));
  if (jobInfo === undefined) return;

  const job = jobInfo[0];
  return job;
};

const createMessageFromEventInfo = (eventInfo: EventInfo) => {
  const formattedDate = format(new Date(eventInfo.date), "MM/dd");
  return `${eventInfo.title}: ${formattedDate} ${eventInfo.startTime}~${eventInfo.endTime}`;
};

const createRegistrationMessage = (registrationInfos: EventInfo[]): string => {
  const messages = registrationInfos.map(createMessageFromEventInfo);
  const messageTitle = "以下の予定が追加されました。";
  return `${messageTitle}\n${messages.join("\n")}`;
};

const createDeletionMessage = (deletionInfos: EventInfo[]): string | undefined => {
  const messages = deletionInfos.map(createMessageFromEventInfo);
  if (messages.length == 0) return;
  const messageTitle = "以下の予定が削除されました。";
  return `${messageTitle}\n${messages.join("\n")}`;
};

const createModificationMessage = (
  modificationInfos: {
    previousEventInfo: EventInfo;
    newEventInfo: EventInfo;
  }[]
): string | undefined => {
  const messages = modificationInfos.map(({ previousEventInfo, newEventInfo }) => {
    return `${createMessageFromEventInfo(previousEventInfo)}\n\
    → ${createMessageFromEventInfo(newEventInfo)}`;
  });
  if (messages.length == 0) return;
  const messageTitle = "以下の予定が変更されました。";
  return `${messageTitle}\n${messages.join("\n")}`;
};

const postMessageToSlackChannel = (client: SlackClient, slackChannelToPost: string, messageToNotify: string) => {
  const { MEMBER_ID } = getConfig();
  client.chat.postMessage({
    channel: slackChannelToPost,
    text: `<@${MEMBER_ID}>\n${messageToNotify}`,
  });
};

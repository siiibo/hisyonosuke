import { format } from "date-fns";
import { GasWebClient as SlackClient } from "@hi-se/web-api";
import { getConfig } from "./config";
import { EventInfo } from "./shift-changer-api";

type SheetType = "registration" | "modificationAndDeletion";
type OperationType = "registration" | "modificationAndDeletion" | "showEvents";
type SheetValue = {
  date: Date;
  startTime: Date;
  endTime: Date;
  restStartTime: Date | string;
  restEndTime: Date | string;
  workingStyle: string;
};
type PartTimerProfile = {
  job: string;
  lastName: string;
  email: string;
  managerEmails: string[];
};

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

  const description1 = "コメント欄 (下の色付きセルに記入してください)";
  sheet.getRange("A1").setValue(description1).setFontWeight("bold");
  const commentCell = sheet.getRange("A2");
  commentCell.setBackground("#f0f8ff");

  const header = ["日付", "開始時刻", "終了時刻", "休憩開始時刻", "休憩終了時刻", "勤務形態"];
  sheet.getRange(4, 1, 1, header.length).setValues([header]).setFontWeight("bold");

  const workingStyleCells = sheet.getRange("F5:F1000");
  const workingStyleRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["リモート", "出社"], true)
    .setAllowInvalid(false)
    .setHelpText("リモート/出社 を選択してください。")
    .build();
  workingStyleCells.setDataValidation(workingStyleRule);
  const dateCells = sheet.getRange("A5:A1000");
  const dateRule = SpreadsheetApp.newDataValidation()
    .requireDateOnOrAfter(new Date())
    .setAllowInvalid(false)
    .setHelpText("本日以降の日付を入力してください。")
    .build();
  dateCells.setDataValidation(dateRule);
  const timeCells = sheet.getRange("B5:E1000");
  const timeRule = SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied("=ISDATE(B5)")
    .setHelpText('時刻を"◯◯:◯◯"の形式で入力してください。')
    .build();
  timeCells.setDataValidation(timeRule);
};

export const insertModificationAndDeletionSheet = () => {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const today = format(new Date(), "yyyy-MM-dd");
  const sheet = spreadsheet.insertSheet(`${today}-変更・削除`, 0);
  sheet.addDeveloperMetadata(`${today}-modificationAndDeletion`);

  const description1 = "コメント欄 (下の色付きセルに記入してください)";
  sheet.getRange("A1").setValue(description1).setFontWeight("bold");
  const commentCell = sheet.getRange("A2");
  commentCell.setBackground("#f0f8ff");

  const description2 = "本日以降の日付を下の色付きセルに記入してください。一週間後までの予定が表示されます。";
  sheet.getRange("A4").setValue(description2).setFontWeight("bold");
  const dateCell = sheet.getRange("A5");
  dateCell.setValue(today);
  dateCell.setBackground("#f0f8ff");

  const description3 = "【予定一覧】";
  sheet.getRange("A7").setValue(description3).setFontWeight("bold");

  const description4 = "【変更】変更後の予定を記入してください ";
  sheet.getRange("E7").setValue(description4).setFontWeight("bold");

  const description5 = "【削除】削除したい予定を選択してください";
  sheet.getRange("K7").setValue(description5).setFontWeight("bold");

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
  sheet.getRange(8, 1, 1, header.length).setValues([header]).setFontWeight("bold");

  const dateCells = sheet.getRange("E9:E1000");
  const dateRule = SpreadsheetApp.newDataValidation()
    .requireDateOnOrAfter(new Date())
    .setAllowInvalid(false)
    .setHelpText("本日以降の日付を入力してください。")
    .build();
  dateCell.setDataValidation(dateRule);
  dateCells.setDataValidation(dateRule);
  const timeCells = sheet.getRange("F9:I1000");
  const timeRule = SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied("=ISDATE(F9)")
    .setAllowInvalid(false)
    .setHelpText('時刻を"◯◯:◯◯"の形式で入力してください。\n【例】 9:00')
    .build();
  timeCells.setDataValidation(timeRule);
  const workingStyleCells = sheet.getRange("J9:J1000");
  const workingStyleRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["リモート", "出社"], true)
    .setAllowInvalid(false)
    .setHelpText("リモート/出社 を選択してください。")
    .build();
  workingStyleCells.setDataValidation(workingStyleRule);
  const checkboxCells = sheet.getRange("K9:K1000");
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
  const partTimerProfile = getPartTimerProfile(userEmail);

  const sheetType: SheetType = "registration";
  const sheet = getSheet(sheetType, spreadsheetUrl);
  const operationType: OperationType = "registration";
  const comment = sheet.getRange("A2").getValue();
  const sheetValues = getRegistrationSheetValues(sheet);
  const registrationInfos = getRegistrationInfos(sheetValues, partTimerProfile);

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
  const messageToNotify = createRegistrationMessage(sheetValues, comment, partTimerProfile);
  postMessageToSlackChannel(client, SLACK_CHANNEL_TO_POST, messageToNotify, partTimerProfile);
};

const getModificationAndDeletionSheetValues = (
  sheet: GoogleAppsScript.Spreadsheet.Sheet
): {
  title: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  newDate: Date;
  newStartTime: Date;
  newEndTime: Date;
  newRestStartTime: Date | string;
  newRestEndTime: Date | string;
  newWorkingStyle: string;
  deletionFlag: boolean;
}[] => {
  const sheetValues = sheet
    .getRange(9, 1, sheet.getLastRow() - 8, sheet.getLastColumn())
    .getValues()
    .map((row) => {
      if (row[7] === "" || row[8] === "") {
        return {
          title: row[0] as string,
          date: row[1] as Date,
          startTime: row[2] as Date,
          endTime: row[3] as Date,
          newDate: row[4] as Date,
          newStartTime: row[5] as Date,
          newEndTime: row[6] as Date,
          newRestStartTime: row[7] as string,
          newRestEndTime: row[8] as string,
          newWorkingStyle: row[9] as string,
          deletionFlag: row[10] as boolean,
        };
      } else {
        return {
          title: row[0] as string,
          date: row[1] as Date,
          startTime: row[2] as Date,
          endTime: row[3] as Date,
          newDate: row[4] as Date,
          newStartTime: row[5] as Date,
          newEndTime: row[6] as Date,
          newRestStartTime: row[7] as Date,
          newRestEndTime: row[8] as Date,
          newWorkingStyle: row[9] as string,
          deletionFlag: row[10] as boolean,
        };
      }
    });

  return sheetValues;
};

const getModificationInfos = (
  sheetValues: {
    title: string;
    date: Date;
    startTime: Date;
    endTime: Date;
    newDate: Date;
    newStartTime: Date;
    newEndTime: Date;
    newRestStartTime: Date | string;
    newRestEndTime: Date | string;
    newWorkingStyle: string;
    deletionFlag: boolean;
  }[],
  partTimerProfile: PartTimerProfile
): {
  previousEventInfo: EventInfo;
  newEventInfo: EventInfo;
}[] => {
  const modificationInfos = sheetValues.map((row) => {
    const title = row.title;
    const date = format(row.date, "yyyy-MM-dd");
    const startTime = format(row.startTime, "HH:mm");
    const endTime = format(row.endTime, "HH:mm");
    const newDate = format(row.newDate, "yyyy-MM-dd");
    const newStartTime = format(row.newStartTime, "HH:mm");
    const newEndTime = format(row.newEndTime, "HH:mm");
    if (row.newRestStartTime === "" || row.newRestEndTime === "") {
      const newRestStartTime = row.newRestStartTime as string;
      const newRestEndTime = row.newRestEndTime as string;
      const newWorkingStyle = row.newWorkingStyle;
      if (newWorkingStyle === "") throw new Error("new working style is not defined");
      const newTitle = createTitleFromEventInfo(
        { restStartTime: newRestStartTime, restEndTime: newRestEndTime, workingStyle: newWorkingStyle },
        partTimerProfile
      );
      return {
        previousEventInfo: { title, date, startTime, endTime },
        newEventInfo: { title: newTitle, date: newDate, startTime: newStartTime, endTime: newEndTime },
      };
    } else {
      const newRestStartTime = format(row.newRestStartTime as Date, "HH:mm");
      const newRestEndTime = format(row.newRestEndTime as Date, "HH:mm");
      const newWorkingStyle = row.newWorkingStyle;
      const newTitle = createTitleFromEventInfo(
        { restStartTime: newRestStartTime, restEndTime: newRestEndTime, workingStyle: newWorkingStyle },
        partTimerProfile
      );
      return {
        previousEventInfo: { title, date, startTime, endTime },
        newEventInfo: { title: newTitle, date: newDate, startTime: newStartTime, endTime: newEndTime },
      };
    }
  });

  return modificationInfos;
};

const getDeletionInfos = (
  sheetValues: {
    title: string;
    date: Date;
    startTime: Date;
    endTime: Date;
    newDate: Date;
    newStartTime: Date;
    newEndTime: Date;
    newRestStartTime: Date | string;
    newRestEndTime: Date | string;
    newWorkingStyle: string;
    deletionFlag: boolean;
  }[]
): EventInfo[] => {
  const deletionInfos = sheetValues.map((row) => {
    const title = row.title;
    const date = format(row.date, "yyyy-MM-dd");
    const startTime = format(row.startTime, "HH:mm");
    const endTime = format(row.endTime, "HH:mm");
    return { title, date, startTime, endTime };
  });

  return deletionInfos;
};
export const callModificationAndDeletion = () => {
  const userEmail = Session.getActiveUser().getEmail();
  const spreadsheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  const { SLACK_ACCESS_TOKEN } = getConfig();
  const client = getSlackClient(SLACK_ACCESS_TOKEN);
  const partTimerProfile = getPartTimerProfile(userEmail);
  const sheetType: SheetType = "modificationAndDeletion";
  const sheet = getSheet(sheetType, spreadsheetUrl);
  const comment = sheet.getRange("A2").getValue();
  const operationType: OperationType = "modificationAndDeletion";
  const sheetValues = getModificationAndDeletionSheetValues(sheet);
  const valuesForOperation = sheetValues.filter((row) => row.deletionFlag || row.newDate);
  const modificationSheetValues = valuesForOperation.filter((row) => !row.deletionFlag);
  const deletionSheetValues = valuesForOperation.filter((row) => row.deletionFlag);
  const modificationInfos = getModificationInfos(modificationSheetValues, partTimerProfile);
  const deletionInfos = getDeletionInfos(deletionSheetValues);

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

  const modificationMessageToNotify = createModificationMessage(modificationSheetValues, comment, partTimerProfile);
  if (modificationMessageToNotify)
    postMessageToSlackChannel(client, SLACK_CHANNEL_TO_POST, modificationMessageToNotify, partTimerProfile);

  const deletionMessageToNotify = createDeletionMessage(deletionSheetValues, comment, partTimerProfile);
  if (deletionMessageToNotify)
    postMessageToSlackChannel(client, SLACK_CHANNEL_TO_POST, deletionMessageToNotify, partTimerProfile);
};

export const callShowEvents = () => {
  const userEmail = Session.getActiveUser().getEmail();
  const spreadsheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  const sheetType: SheetType = "modificationAndDeletion";
  const sheet = getSheet(sheetType, spreadsheetUrl);
  const operationType: OperationType = "showEvents";
  const startDate: Date = sheet.getRange("A5").getValue();
  if (!startDate) throw new Error("日付を指定してください。");

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
  if (eventInfos.length === 0) throw new Error("no events");

  const moldedEventInfos = eventInfos.map(({ title, date, startTime, endTime }) => {
    return [title, date, startTime, endTime];
  });

  if (sheet.getLastRow() > 8) {
    sheet.getRange(9, 1, sheet.getLastRow() - 8, sheet.getLastColumn()).clearContent();
  }

  sheet.getRange(9, 1, moldedEventInfos.length, moldedEventInfos[0].length).setValues(moldedEventInfos);
};

const getSheet = (sheetType: SheetType, spreadsheetUrl: string): GoogleAppsScript.Spreadsheet.Sheet => {
  const today = format(new Date(), "yyyy-MM-dd");
  const sheet = SpreadsheetApp.openByUrl(spreadsheetUrl)
    .getSheets()
    .find((sheet) => sheet.getDeveloperMetadata().some((metaData) => metaData.getKey() === `${today}-${sheetType}`));

  if (!sheet) throw new Error("SHEET is not defined");

  return sheet;
};

const getRegistrationSheetValues = (sheet: GoogleAppsScript.Spreadsheet.Sheet): SheetValue[] => {
  const sheetValues = sheet
    .getRange(5, 1, sheet.getLastRow() - 4, sheet.getLastColumn())
    .getValues()
    .map((row) => {
      if (row[3] === "" || row[4] === "") {
        return {
          date: row[0] as Date,
          startTime: row[1] as Date,
          endTime: row[2] as Date,
          restStartTime: row[3] as string,
          restEndTime: row[4] as string,
          workingStyle: row[5] as string,
        };
      } else {
        return {
          date: row[0] as Date,
          startTime: row[1] as Date,
          endTime: row[2] as Date,
          restStartTime: row[3] as Date,
          restEndTime: row[4] as Date,
          workingStyle: row[5] as string,
        };
      }
    });

  return sheetValues;
};

const getRegistrationInfos = (sheetValues: SheetValue[], partTimerProfile: PartTimerProfile): EventInfo[] => {
  const registrationInfos = sheetValues.map((row) => {
    const date = format(row.date, "yyyy-MM-dd");
    const startTime = format(row.startTime, "HH:mm");
    const endTime = format(row.endTime, "HH:mm");
    const workingStyle = row.workingStyle;
    if (workingStyle === "") throw new Error("working style is not defined");
    if (row.restStartTime === "" || row.restEndTime === "") {
      const restStartTime = row.restStartTime as string;
      const restEndTime = row.restEndTime as string;
      const title = createTitleFromEventInfo(
        { restStartTime: restStartTime, restEndTime: restEndTime, workingStyle: workingStyle },
        partTimerProfile
      );
      return { title, date, startTime, endTime };
    } else {
      const restStartTime = format(row.restStartTime as Date, "HH:mm");
      const restEndTime = format(row.restEndTime as Date, "HH:mm");
      const title = createTitleFromEventInfo(
        { restStartTime: restStartTime, restEndTime: restEndTime, workingStyle: workingStyle },
        partTimerProfile
      );
      return { title, date, startTime, endTime };
    }
  });
  return registrationInfos;
};

const createTitleFromEventInfo = (
  eventInfo: {
    restStartTime: string;
    restEndTime: string;
    workingStyle: string;
  },
  partTimerProfile: PartTimerProfile
): string => {
  const { job, lastName } = partTimerProfile;

  const restStartTime = eventInfo.restStartTime;
  const restEndTime = eventInfo.restEndTime;
  const workingStyle = eventInfo.workingStyle;

  if (restStartTime === "" || restEndTime === "") {
    const title = `【${workingStyle}】${job}${lastName}さん`;
    return title;
  } else {
    const title = `【${workingStyle}】${job}${lastName}さん (休憩: ${restStartTime}~${restEndTime})`;
    return title;
  }
};

const getSlackClient = (slackToken: string): SlackClient => {
  return new SlackClient(slackToken);
};

const getPartTimerProfile = (
  userEmail: string
): {
  job: string;
  lastName: string;
  email: string;
  managerEmails: string[];
} => {
  const { JOB_SHEET_URL } = getConfig();
  const sheet = SpreadsheetApp.openByUrl(JOB_SHEET_URL).getSheetByName("シート1");
  if (!sheet) throw new Error("SHEET is not defined");
  const partTimerProfiles = sheet
    .getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn())
    .getValues()
    .map((row) => ({
      job: row[0] as string,
      // \u3000は全角空白
      lastName: row[1].split(/(\s|\u3000)+/)[0] as string,
      email: row[2] as string,
      managerEmails: row[3] === "" ? [] : (row[3] as string).replaceAll(/\s/g, "").split(","),
    }));

  const partTimerProfile = partTimerProfiles.find(({ email }) => {
    return email === userEmail;
  });
  if (partTimerProfile === undefined) throw new Error("no part timer information for the email");

  return partTimerProfile;
};

const createMessageFromEventInfo = (sheetValue: SheetValue) => {
  const date = format(new Date(sheetValue.date), "MM/dd");
  const startTime = format(new Date(sheetValue.startTime), "HH:mm");
  const endTime = format(new Date(sheetValue.endTime), "HH:mm");
  const workingStyle = sheetValue.workingStyle;
  if (sheetValue.restStartTime === "" || sheetValue.restEndTime === "")
    return `【${workingStyle}】 ${date} ${startTime}~${endTime}`;
  else {
    const restStartTime = format(new Date(sheetValue.restStartTime), "HH:mm");
    const restEndTime = format(new Date(sheetValue.restEndTime), "HH:mm");
    return `【${workingStyle}】 ${date} ${startTime}~${endTime} (休憩: ${restStartTime}~${restEndTime})`;
  }
};

const createRegistrationMessage = (
  sheetValues: SheetValue[],
  comment: string,
  partTimerProfile: PartTimerProfile
): string => {
  const messages = sheetValues.map(createMessageFromEventInfo);
  const { job, lastName } = partTimerProfile;
  const messageTitle = `${job}${lastName}さんの以下の予定が追加されました。`;
  return comment
    ? `${messageTitle}\n${messages.join("\n")}\n\nコメント: ${comment}`
    : `${messageTitle}\n${messages.join("\n")}`;
};

const createDeletionMessage = (
  deletionSheetValues: {
    title: string;
    date: Date;
    startTime: Date;
    endTime: Date;
    newDate: Date;
    newStartTime: Date;
    newEndTime: Date;
    newRestStartTime: Date | string;
    newRestEndTime: Date | string;
    newWorkingStyle: string;
    deletionFlag: boolean;
  }[],
  comment: string,
  partTimerProfile: PartTimerProfile
): string | undefined => {
  const messages = deletionSheetValues.map((sheetValue) => {
    const { workingStyle, restStartTime, restEndTime } = getEventInfoFromTitle(sheetValue.title);
    return createMessageFromEventInfo({
      date: sheetValue.date,
      startTime: sheetValue.startTime,
      endTime: sheetValue.endTime,
      restStartTime,
      restEndTime,
      workingStyle,
    });
  });
  if (messages.length == 0) return;
  const { job, lastName } = partTimerProfile;
  const messageTitle = `${job}${lastName}さんの以下の予定が削除されました。`;
  return comment
    ? `${messageTitle}\n${messages.join("\n")}\n\nコメント: ${comment}`
    : `${messageTitle}\n${messages.join("\n")}`;
};

const createModificationMessage = (
  modificationSheetValues: {
    title: string;
    date: Date;
    startTime: Date;
    endTime: Date;
    newDate: Date;
    newStartTime: Date;
    newEndTime: Date;
    newRestStartTime: Date | string;
    newRestEndTime: Date | string;
    newWorkingStyle: string;
    deletionFlag: boolean;
  }[],
  comment: string,
  partTimerProfile: PartTimerProfile
): string | undefined => {
  const modificationSheetInfos = modificationSheetValues.map((sheetValue) => {
    const { workingStyle, restStartTime, restEndTime } = getEventInfoFromTitle(sheetValue.title);
    return {
      previousEventInfo: {
        date: sheetValue.date,
        startTime: sheetValue.startTime,
        endTime: sheetValue.endTime,
        restStartTime,
        restEndTime,
        workingStyle,
      },
      newEventInfo: {
        date: sheetValue.newDate,
        startTime: sheetValue.newStartTime,
        endTime: sheetValue.newEndTime,
        restStartTime: sheetValue.newRestStartTime,
        restEndTime: sheetValue.newRestEndTime,
        workingStyle: sheetValue.newWorkingStyle,
      },
    };
  });

  const messages = modificationSheetInfos.map(({ previousEventInfo, newEventInfo }) => {
    return `---
    ${createMessageFromEventInfo(previousEventInfo)}\n
    ↓\n
    ${createMessageFromEventInfo(newEventInfo)}`;
  });
  if (messages.length == 0) return;
  const { job, lastName } = partTimerProfile;
  const messageTitle = `${job}${lastName}さんの以下の予定が変更されました。`;
  return comment
    ? `${messageTitle}\n${messages.join("\n")}\n\nコメント: ${comment}`
    : `${messageTitle}\n${messages.join("\n")}`;
};

const getManagerSlackIds = (managerEmails: string[], client: SlackClient): string[] => {
  const slackMembers = client.users.list().members ?? [];

  const managerSlackIds = managerEmails
    .map((email) => {
      const member = slackMembers.find((slackMember) => {
        return slackMember.profile?.email === email;
      });
      if (member === undefined) throw new Error("The manager email is not in the slack members");
      return member.id;
    })
    .filter((id): id is string => id !== undefined);

  return managerSlackIds;
};

const getEventInfoFromTitle = (
  title: string
): { workingStyle: string; restStartTime: Date | string; restEndTime: Date | string } => {
  const workingStyleRegex = /【(.*?)】/;
  const matchResult = title.match(workingStyleRegex);
  const workingStyle = matchResult ? matchResult[1] : "未設定";

  const restTimeRegex = /\(休憩: (.*?)\)/;
  const restTimeResult = title.match(restTimeRegex);
  const restStartTime = restTimeResult
    ? new Date(`${format(new Date(), "MM/dd")} ${restTimeResult[1].split("~")[0]}`)
    : "";
  const restEndTime = restTimeResult
    ? new Date(`${format(new Date(), "MM/dd")} ${restTimeResult[1].split("~")[1]}`)
    : "";
  return { workingStyle, restStartTime, restEndTime };
};
const slackIdToMention = (slackId: string) => `<@${slackId}>`;

const postMessageToSlackChannel = (
  client: SlackClient,
  slackChannelToPost: string,
  messageToNotify: string,
  partTimerProfile: PartTimerProfile
) => {
  const { HR_MANAGER_SLACK_ID } = getConfig();
  const { managerEmails } = partTimerProfile;
  const managerSlackIds = getManagerSlackIds(managerEmails, client);
  const mentionMessageToManagers = [HR_MANAGER_SLACK_ID, ...managerSlackIds].map(slackIdToMention).join(" ");
  client.chat.postMessage({
    channel: slackChannelToPost,
    text: `${mentionMessageToManagers}\n${messageToNotify}`,
  });
};

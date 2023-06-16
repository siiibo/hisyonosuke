import { format } from "date-fns";
import { GasWebClient as SlackClient } from "@hi-se/web-api";

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
  sheet.addDeveloperMetadata(`${today}-modificationAndDeletion`);

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
    .setHelpText('時刻を"◯◯:◯◯"の形式で入力してください。\n【例】 9:00')
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

  // 列幅の設定
  sheet.setColumnWidth(1, 370);
};
export const callRegistration = () => {
  const userEmail = Session.getActiveUser().getEmail();
  const spreadsheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  const slackAccessToken = PropertiesService.getScriptProperties().getProperty("SLACK_ACCESS_TOKEN");
  if (!slackAccessToken) throw new Error("SLACK_ACCESS_TOKEN is not defined");
  const client = getSlackClient(slackAccessToken);
  const slackMemberProfiles = getSlackMemberProfiles(client);
  const operationType = "registration";

  const shiftInfos = getShiftInfos(operationType, spreadsheetUrl);
  if (shiftInfos === undefined) return;

  const registrationInfos = shiftInfos.map((shiftInfo) => {
    const date = format(shiftInfo[0], "yyyy-MM-dd");
    const startTime = format(shiftInfo[1], "HH:mm");
    const endTime = format(shiftInfo[2], "HH:mm");
    const title = createTitleFromShiftInfo(shiftInfo, userEmail, slackMemberProfiles);
    return { title: title, date: date, startTime: startTime, endTime: endTime };
  });

  const payload = {
    external_id: "shift-changer",
    operationType: "registration",
    userEmail: userEmail,
    spreadsheetUrl: spreadsheetUrl,
    registrationInfos: JSON.stringify(registrationInfos),
  };
  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "post",
    payload: payload,
  };
  const url = PropertiesService.getScriptProperties().getProperty("API_URL");
  if (!url) throw new Error("API_URL is not defined");
  UrlFetchApp.fetch(url, options);

  const slackChannelToPost = PropertiesService.getScriptProperties().getProperty("SLACK_CHANNEL_TO_POST");
  if (!slackChannelToPost) throw new Error("SLACK_CHANNEL_TO_POST is not defined");
  const messageToNotify = createRegistrationMessage(registrationInfos);
  postMessageToSlackChannel(client, slackChannelToPost, messageToNotify);
};

export const callModificationAndDeletion = () => {
  const userEmail = Session.getActiveUser().getEmail();
  const spreadsheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  const payload = {
    external_id: "shift-changer",
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
  const operationType = "modificationAndDeletion";
  const sheet = getSheet(operationType, spreadsheetUrl);
  const startDate = sheet.getRange("A2").getValue();

  const payload = {
    external_id: "shift-changer",
    operationType: "showEvents",
    userEmail: userEmail,
    spreadsheetUrl: spreadsheetUrl,
    startDate: startDate,
  };
  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "post",
    payload: payload,
  };
  const url = PropertiesService.getScriptProperties().getProperty("API_URL");
  if (!url) throw new Error("API_URL is not defined");
  const response = UrlFetchApp.fetch(url, options);
  if (!response.getContentText()) return;

  const eventInfos: { title: string; date: string; startTime: string; endTime: string }[] = JSON.parse(
    response.getContentText()
  );
  const moldedEventInfos = eventInfos.map((eventInfo) => {
    return [eventInfo.title, eventInfo.date, eventInfo.startTime, eventInfo.endTime];
  });
  sheet.getRange(6, 1, moldedEventInfos.length, moldedEventInfos[0].length).setValues(moldedEventInfos);
};

const getSheet = (operationType: OperationType, spreadsheetUrl: string): GoogleAppsScript.Spreadsheet.Sheet => {
  const today = format(new Date(), "yyyy-MM-dd");
  const sheet = SpreadsheetApp.openByUrl(spreadsheetUrl)
    .getSheets()
    .find((sheet) => sheet.getDeveloperMetadata()[0].getKey() === `${today}-${operationType}`);

  if (!sheet) throw new Error("SHEET is not defined");

  return sheet;
};

const getShiftInfos = (operationType: OperationType, spreadsheetUrl: string) => {
  switch (operationType) {
    case "registration": {
      const sheet = getSheet(operationType, spreadsheetUrl);
      const lastRowNum = sheet.getLastRow();
      const shiftInfos = sheet.getRange(2, 1, lastRowNum - 1, 6).getValues();
      return shiftInfos;
    }

    case "modificationAndDeletion": {
      const sheet = getSheet(operationType, spreadsheetUrl);
      const lastRowNum = sheet.getLastRow();
      const shiftInfos = sheet.getRange(6, 5, lastRowNum - 5, 6).getValues();
      return shiftInfos;
    }
  }
};

const createTitleFromShiftInfo = (
  shiftInfo: any[],
  userEmail: string,
  slackMemberProfiles: {
    name: string;
    email: string;
  }[]
): string => {
  const name = getNameFromEmail(userEmail, slackMemberProfiles);
  const nameRegex = new RegExp(name.replace(/ |\u3000/g, "( |\u3000|)?"));
  const job = getJob(nameRegex);

  const workingStyle = shiftInfo[5];

  if (shiftInfo[3] === "" || shiftInfo[4] === "") {
    const title = `【${workingStyle}】${job}: ${name}さん`;
    return title;
  } else {
    const restStartTime = format(shiftInfo[3], "HH:mm");

    const restEndTime = format(shiftInfo[4], "HH:mm");

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

const getJob = (nameRegex: RegExp): string | undefined => {
  // 人対職種データベース
  const spreadSheetUrl = "https://docs.google.com/spreadsheets/d/1g-n_RL7Rou8chG3n_GOyieBbtPTl6eTkDsGQLRWXKbI/edit";
  const sheet = SpreadsheetApp.openByUrl(spreadSheetUrl).getSheetByName("シート1");
  if (!sheet) throw new Error("SHEET is not defined");
  const lastRowNum = sheet.getLastRow();
  const jobInfos = sheet.getRange(1, 1, lastRowNum, 2).getValues();
  const jobInfo = jobInfos.find((jobInfo) => jobInfo[1].match(nameRegex));
  if (jobInfo === undefined) return;

  const job = jobInfo[0];
  return job;
};

const createRegistrationMessage = (
  registrationInfos: { title: string; date: string; startTime: string; endTime: string }[]
): string => {
  const messages = registrationInfos.map((registrationInfo) => {
    const startTime = registrationInfo.startTime;
    const endTime = registrationInfo.endTime;
    const date = format(new Date(registrationInfo.date), "MM/dd");
    return `${registrationInfo.title}: ${date} ${startTime}~${endTime}`;
  });
  const messageTitle = "以下の予定が追加されました。\n";
  return messageTitle + messages.join("\n");
};

const postMessageToSlackChannel = (client: SlackClient, slackChannelToPost: string, messageToNotify: string) => {
  console.log("slackChannelToPost", slackChannelToPost);
  client.chat.postMessage({
    channel: slackChannelToPost,
    text: messageToNotify,
  });
};

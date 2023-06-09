import { format } from "date-fns";

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
  const payload = {
    external_id: "shift-changer",
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
  const payload = {
    external_id: "shift-changer",
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

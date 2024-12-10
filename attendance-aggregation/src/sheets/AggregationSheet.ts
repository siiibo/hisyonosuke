import { z } from "zod";

const HEADER = ["日時", "ユーザー", "メッセージ", "リアクション (from 秘書之介)", "リモート"];

const AttendanceHistorySchema = z.object({
  dateString: z.string(),
  userEmail: z.string().email(),
  message: z.string(),
  reactionFromBot: z.string(),
  isRemote: z.union([z.literal("リモート"), z.literal("")]),
});

export type AttendanceHistory = z.infer<typeof AttendanceHistorySchema>;
export interface ColorConfig {
  text: string[];
  colorCode: string;
}

export const setColors = (sheet: GoogleAppsScript.Spreadsheet.Sheet, colorConfigs: ColorConfig[]) => {
  colorConfigs.forEach((config) => {
    const targetTextRegExp = config.text.map((s) => `^${s}.{0,4}$`).join("|"); // IEYASUユーザーはコマンドの後に任意の文字列を置くので、それを拾えるようにしてある
    sheet
      .createTextFinder(targetTextRegExp)
      .useRegularExpression(true)
      .findAll()
      .forEach((range) => {
        range.setBackground(config.colorCode);
      });
  });
};

export const createSheet = (spreadsheetUrl: string, newSheetName: string) => {
  const sheet = SpreadsheetApp.openByUrl(spreadsheetUrl).insertSheet(newSheetName, 0); // NOTE: positionはとりあえず一番左に設定してある
  return sheet;
};

export const resizeColumns = (sheet: GoogleAppsScript.Spreadsheet.Sheet) => {
  sheet.autoResizeColumns(1, HEADER.length - 1);
  sheet.setColumnWidth(3, 100); // [メッセージ] 列だけ幅が広くなりすぎないように固定値で調整
};

export const setHeader = (sheet: GoogleAppsScript.Spreadsheet.Sheet): GoogleAppsScript.Spreadsheet.Range => {
  return sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER]);
};

export const setContents = (
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  contents: AttendanceHistory[],
): GoogleAppsScript.Spreadsheet.Range => {
  return sheet.getRange(2, 1, contents.length, HEADER.length).setValues(
    contents.map((attendance) => {
      return [
        attendance.dateString,
        attendance.userEmail,
        attendance.message,
        attendance.reactionFromBot,
        attendance.isRemote,
      ];
    }),
  );
};

/**
 * ユーザー昇順 → 日時昇順 の順番でソート
 */
export const sortContents = (sheet: GoogleAppsScript.Spreadsheet.Sheet): GoogleAppsScript.Spreadsheet.Range => {
  return getContentRange(sheet).sort([2, 1]);
};

const getContentRange = (sheet: GoogleAppsScript.Spreadsheet.Sheet): GoogleAppsScript.Spreadsheet.Range => {
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADER.length);
};

/**
 * 人手でfilterを作ることが確定しているので、あらかじめルール未適用のfilterを作成しておく
 */
export const createFilter = (sheet: GoogleAppsScript.Spreadsheet.Sheet): GoogleAppsScript.Spreadsheet.Filter => {
  return sheet.getDataRange().createFilter();
};

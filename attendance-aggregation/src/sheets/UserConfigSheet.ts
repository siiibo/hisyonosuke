import { z } from "zod";

const UserConfigSchema = z.object({
  outputSpreadSheetUrl: z.string(), // NOTE: GASではzodのurl parserが使えない
  targetYear: z.number(),
  targetMonth: z.number(),
});

export type UserConfig = z.infer<typeof UserConfigSchema>;

export const getUserConfig = (spreadsheetUrl: string, sheetName: string): UserConfig => {
  const userConfigSheet = SpreadsheetApp.openByUrl(spreadsheetUrl).getSheetByName(sheetName);
  if (!userConfigSheet)
    throw new Error(`UserConfigSheet was not found.\nurl: ${spreadsheetUrl}\nsheetName: ${sheetName}`);

  const sheetValues = userConfigSheet.getRange(1, 2, 3, 1).getValues().flat();

  return UserConfigSchema.parse({
    outputSpreadSheetUrl: sheetValues[0],
    targetYear: sheetValues[1],
    targetMonth: sheetValues[2],
  });
};

export const createOnOpen = (f: (args: unknown) => unknown) => {
  return () => {
    SpreadsheetApp.getUi().createMenu("勤怠集計").addItem("集計作成", f.name).addToUi();
  };
};

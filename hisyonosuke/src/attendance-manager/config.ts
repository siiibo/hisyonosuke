import { z } from "zod";

const CONFIG_SPREADSHEET_ID = "1fAxgi14OJx6f8RrnUMMoELF--mSZPMWgl3Zz_CUGYL8";

const ConfigSchema = z.object({
  ATTENDANCE_MANAGER_ENV: z.union([z.literal("production"), z.literal("development")]),
  FREEE_CLIENT_ID: z.string(),
  FREEE_CLIENT_SECRET: z.string(),
  FREEE_COMPANY_ID: z.preprocess((v) => Number(v), z.number()),
  SLACK_TOKEN: z.string(),
  BOT_USER_ID: z.string(), // ボットはbot_idとuser_idの2つのidを持ち、リアクションにはuser_idが使われる
  CHANNEL_IDS: z.string().transform((v) => v.replace(/\s/g, "").split(",")),
  ATTENDANCE_CHANNEL_ID: z.string(),
  PART_TIMER_CHANNEL_ID: z.string(),
  TEST_CHANNEL_ID: z.string(),
});

export type Config = z.infer<typeof ConfigSchema>;

export function getConfig(): Config {
  const props = PropertiesService.getScriptProperties().getProperties();
  return ConfigSchema.parse(props);
}

export function initConfig(): void {
  const sheet = SpreadsheetApp.openById(CONFIG_SPREADSHEET_ID).getSheets()[0];
  const values = sheet
    .getRange(2, 2, sheet.getLastRow() - 1, 1)
    .getValues()
    .flat();
  const configs = {
    FREEE_CLIENT_ID: values[0],
    FREEE_CLIENT_SECRET: values[1],
    FREEE_COMPANY_ID: values[2],
    SLACK_TOKEN: values[3],
    ATTENDANCE_CHANNEL_ID: values[4],
    PART_TIMER_CHANNEL_ID: values[5],
    TEST_CHANNEL_ID: values[6],
  };
  PropertiesService.getScriptProperties().setProperties(configs);
}

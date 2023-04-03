import { z } from "zod";

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

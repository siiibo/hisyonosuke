import { z } from "zod";

const ConfigSchema = z.object({
  SLACK_TOKEN: z.string(),
  USER_CONFIG_SPREADSHEET_URL: z.string(), // NOTE: GASではzodのurl parserが使えない
  USER_CONFIG_SHEET_NAME: z.string(),
});

export type Config = z.infer<typeof ConfigSchema>;

let config: Config;

export const getConfig = () => {
  if (!config) {
    const props = PropertiesService.getScriptProperties().getProperties();
    config = ConfigSchema.parse(props);
  }
  return config;
};

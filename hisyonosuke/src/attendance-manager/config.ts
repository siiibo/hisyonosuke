const CONFIG_SPREADSHEET_ID = '1urycTYGkcfVfKOndBEHJm8kTqfeQmhF10cUWyrppBZ4';

interface Config {
  FREEE_CLIENT_ID: string,
  FREEE_CLIENT_SECRET: string,
  SLACK_TOKEN: string,
  ATTENDANCE_CHANNEL_ID: string
  TEST_CHANNEL_ID: string
}

export function getConfig(): Config {
  const props = PropertiesService.getScriptProperties().getProperties();
  return {
    FREEE_CLIENT_ID: props['FREEE_CLIENT_ID'],
    FREEE_CLIENT_SECRET: props['FREEE_CLIENT_SECRET'],
    SLACK_TOKEN: props['SLACK_TOKEN'],
    ATTENDANCE_CHANNEL_ID: props['ATTENDANCE_CHANNEL_ID'],
    TEST_CHANNEL_ID: props['TEST_CHANNEL_ID']
  }
}

export function initConfig(): void {
  const sheet = SpreadsheetApp.openById(CONFIG_SPREADSHEET_ID).getSheets()[0];
  const values = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues().flat();
  const configs = {
    FREEE_CLIENT_ID: values[0],
    FREEE_CLIENT_SECRET: values[1],
    SLACK_TOKEN: values[2],
    ATTENDANCE_CHANNEL_ID: values[3],
    TEST_CHANNEL_ID: values[4]
  }
  PropertiesService.getScriptProperties().setProperties(configs);
}

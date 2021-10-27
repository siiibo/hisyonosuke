const CONFIG_SPREADSHEET_ID = '1urycTYGkcfVfKOndBEHJm8kTqfeQmhF10cUWyrppBZ4';

interface Config {
  FREEE_CLIENT_ID: string,
  FREEE_CLIENT_SECRET: string,
  SLACK_TOKEN: string,
  ATTENDANCE_CHANNEL_ID: string
  TEST_CHANNEL_ID: string
}

export function getConfig(): Config {
  // TODO: ScriptPropertyを挟む (パフォーマンスに影響がなければスプレッドシートのままで良いが)
  const sheet = SpreadsheetApp.openById(CONFIG_SPREADSHEET_ID).getSheets()[0];
  const values = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues().flat();
  return {
    FREEE_CLIENT_ID: values[0],
    FREEE_CLIENT_SECRET: values[1],
    SLACK_TOKEN: values[2],
    ATTENDANCE_CHANNEL_ID: values[3],
    TEST_CHANNEL_ID: values[4]
  }
}

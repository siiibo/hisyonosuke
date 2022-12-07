import { startOfMonth, endOfMonth, format } from 'date-fns';
import { CHANNEL_IDS, COMMAND_LABEL } from './constant';
import * as AggregationSheet from './sheets/AggregationSheet';
import type { AttendanceHistory } from './sheets/AggregationSheet'
import { getConversationHistory, getSlackClient, getUserIdList } from './slack';
import { getConfig } from './config';
import { getUserConfig, createOnOpen } from './sheets/UserConfigSheet';


export const main = () => {
  const { SLACK_TOKEN, USER_CONFIG_SPREADSHEET_URL, USER_CONFIG_SHEET_NAME } = getConfig();
  const client = getSlackClient(SLACK_TOKEN);

  const { outputSpreadSheetUrl, targetYear, targetMonth } = getUserConfig(USER_CONFIG_SPREADSHEET_URL, USER_CONFIG_SHEET_NAME);


  const startOfTargetMonth = startOfMonth(new Date(targetYear, targetMonth - 1));
  const endOfTargetMonth = endOfMonth(startOfTargetMonth);

  const userIdList = getUserIdList(client);
  const history = getConversationHistory(client, CHANNEL_IDS.ATTENDANCE, startOfTargetMonth, endOfTargetMonth, userIdList);


  const contents: AttendanceHistory[] = history.map(h => {
    return {
      dateString: h.dateString,
      userEmail: h.user,
      message: Object.keys(COMMAND_LABEL).reduce((pre, current) => {
        return pre.replace(current, COMMAND_LABEL[current as keyof typeof COMMAND_LABEL]);
      }, h.message),
      reactionFromBot: h.reactions.filter(r => !r.includes('memo_remote_ok')).join(','),
      isRemote: h.reactions.includes('memo_remote_ok') ? 'リモート' : '',
    }
  });

  const colorSettings = [
    { text: ['dakoku_memo_error'], colorCode: '#FFE4E1' },
    { text: [COMMAND_LABEL[':remoteshukkin:']], colorCode: '#FFF2CC' },
    { text: [COMMAND_LABEL[':kinmukaishi:'], COMMAND_LABEL[':sagyoukaishi:'], COMMAND_LABEL[':shukkin:'], COMMAND_LABEL[':shussha:']], colorCode: '#E6F4EA' },
    { text: [COMMAND_LABEL[':kinmushuuryou:'], COMMAND_LABEL[':sagyoushuuryou:'], COMMAND_LABEL[':taikin:'], COMMAND_LABEL[':saishuutaikin:']], colorCode: '#C8DAF9' }
  ];

  const newSheetName = format(startOfTargetMonth, 'yyyy/MM');
  const sheet = AggregationSheet.createSheet(outputSpreadSheetUrl, newSheetName);
  AggregationSheet.setHeader(sheet);
  AggregationSheet.setContents(sheet, contents);
  AggregationSheet.sortContents(sheet);
  AggregationSheet.setColors(sheet, colorSettings);
  AggregationSheet.resizeColumns(sheet);
  AggregationSheet.createFilter(sheet);
}

export const init = () => {
  const { USER_CONFIG_SPREADSHEET_URL } = getConfig();
  ScriptApp.newTrigger(onUserConfigSheetOpen.name)
    .forSpreadsheet(SpreadsheetApp.openByUrl(USER_CONFIG_SPREADSHEET_URL))
    .onOpen()
    .create()
}

export const onUserConfigSheetOpen = () => {
  createOnOpen(main)();
}

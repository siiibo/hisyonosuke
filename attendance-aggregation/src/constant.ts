export const CHANNEL_IDS = {
  ATTENDANCE: 'CL0V50APP',
}

// TODO: 打刻機能のworkspaceと共有したい
export const COMMAND_LABEL = {
  ":shukkin:": "出勤",
  ':sagyoukaishi:': "作業開始",
  ':kinmukaishi:': "勤務開始",
  ':shussha:': '出社',
  ':remoteshukkin:': 'リモート出勤',
  ':remote:': 'リモート',
  ':taikin:': '退勤',
  ':sagyoushuuryou:': '作業終了',
  ':saishuutaikin:': '最終退勤',
  ':kinmushuuryou:': '勤務終了',
  ':riseki:': '離席',
  ':modori:': '戻',
  ':back:': '戻',
  ':imback:': '戻',
  ':lunch:': '昼食',
  ':chuushoku:': '昼食',
  ":gaishutsu:": "外出"
} as const;

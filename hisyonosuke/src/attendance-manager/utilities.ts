export function buildUrl(url: string, params: Object) {
  const paramString = Object.entries(params).map(([key, value]) => {
    return encodeURIComponent(key) + '=' + encodeURIComponent(value);
  }).join('&');
  return url + (url.includes('?') ? '&' : '?') + paramString;
}

export function getUnixTimeStampString(date: Date): string {
  return Math.floor(date.getTime() / 1000).toFixed();
}

export function isWorkDay(targetDate: Date) {
  return !isWeekend(targetDate) && !isHoliday(targetDate)
}

function isWeekend(targetDate: Date) {
  return targetDate.getDay() === 0 || targetDate.getDay() === 6;
}

function isHoliday(targetDate: Date): boolean {
  const calendarId = "ja.japanese#holiday@group.v.calendar.google.com";
  const calendar = CalendarApp.getCalendarById(calendarId);
  const todayEvents = calendar.getEventsForDay(targetDate);
  return todayEvents.length > 0
}

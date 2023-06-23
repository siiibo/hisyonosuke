import { addWeeks } from "date-fns";
import { getConfig } from "./config";

export type EventInfo = { title: string; date: string; startTime: string; endTime: string };

const getCalendar = () => {
  const { CALENDAR_ID } = getConfig();
  const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
  return calendar;
};

const isEventGuest = (event: GoogleAppsScript.Calendar.CalendarEvent, email: string) => {
  const guestEmails = event.getGuestList().map((guest) => guest.getEmail());
  return guestEmails.includes(email);
};

export const shiftChanger = (e: GoogleAppsScript.Events.DoPost) => {
  const operationType = e.parameter.operationType;
  const userEmail = e.parameter.userEmail;
  switch (operationType) {
    case "registration": {
      const registrationInfos = JSON.parse(e.parameter.registrationInfos);
      registration(userEmail, registrationInfos);
      break;
    }
    case "modificationAndDeletion": {
      const eventInfosToModify = JSON.parse(e.parameter.eventInfosToModify);
      const eventInfosToDelete = JSON.parse(e.parameter.eventInfosToDelete);
      modification(eventInfosToModify, userEmail);
      deletion(eventInfosToDelete, userEmail);
      break;
    }
    case "showEvents": {
      const startDate = new Date(e.parameter.startDate);
      const eventInfos = showEvents(userEmail, startDate);
      return JSON.stringify(eventInfos);
    }
  }
  return;
};

const registration = (userEmail: string, registrationInfos: EventInfo[]) => {
  registrationInfos.forEach((registrationInfo) => {
    registerEvent(registrationInfo, userEmail);
  });
};

const registerEvent = (registrationInfo: EventInfo, userEmail: string) => {
  const title = registrationInfo.title;
  const date = registrationInfo.date;
  const startTime = registrationInfo.startTime;
  const endTime = registrationInfo.endTime;
  const calendar = getCalendar();

  const startDate = new Date(`${date} ${startTime}`);
  const endDate = new Date(`${date} ${endTime}`);

  calendar.createEvent(title, startDate, endDate, { guests: userEmail });
};

const showEvents = (userEmail: string, startDate: Date): EventInfo[] => {
  const endDate = addWeeks(startDate, 1);
  const calendar = getCalendar();
  const events = calendar.getEvents(startDate, endDate).filter((event) => isEventGuest(event, userEmail));
  const eventInfos = events.map((event) => {
    const title = event.getTitle();
    const date = Utilities.formatDate(event.getStartTime(), "JST", "MM/dd");
    const startTime = Utilities.formatDate(event.getStartTime(), "JST", "HH:mm");
    const endTime = Utilities.formatDate(event.getEndTime(), "JST", "HH:mm");

    return { title, date, startTime, endTime };
  });
  return eventInfos;
};

const modification = (
  eventInfosToModify: {
    previousEventInfo: EventInfo;
    newEventInfo: EventInfo;
  }[],
  userEmail: string
) => {
  const calendar = getCalendar();
  eventInfosToModify.forEach((eventInfo) => modifyEvent(eventInfo, calendar, userEmail));
};

const modifyEvent = (
  eventInfo: {
    previousEventInfo: EventInfo;
    newEventInfo: EventInfo;
  },
  calendar: GoogleAppsScript.Calendar.Calendar,
  userEmail: string
) => {
  // getPreviousEventInfo
  const date = eventInfo.previousEventInfo.date;
  const startTime = eventInfo.previousEventInfo.startTime;
  const endTime = eventInfo.previousEventInfo.endTime;
  const startDate = new Date(`${date} ${startTime}`);
  const endDate = new Date(`${date} ${endTime}`);

  // getNewEventInfo
  const newTitle = eventInfo.newEventInfo.title;

  const newDate = eventInfo.newEventInfo.date;
  const newStartTime = eventInfo.newEventInfo.startTime;
  const newEndTime = eventInfo.newEventInfo.endTime;
  const newStartDate = new Date(`${newDate} ${newStartTime}`);
  const newEndDate = new Date(`${newDate} ${newEndTime}`);

  const event = calendar.getEvents(startDate, endDate).find((event) => isEventGuest(event, userEmail));
  if (!event) return;
  event.setTime(newStartDate, newEndDate);

  event.setTitle(newTitle);
};

const deletion = (eventInfosToDelete: EventInfo[], userEmail: string) => {
  const calendar = getCalendar();
  eventInfosToDelete.forEach((eventInfo) => deleteEvent(eventInfo, calendar, userEmail));
};

const deleteEvent = (eventInfo: EventInfo, calendar: GoogleAppsScript.Calendar.Calendar, userEmail: string) => {
  const date = eventInfo.date;
  const startTime = eventInfo.startTime;
  const endTime = eventInfo.endTime;
  const startDate = new Date(`${date} ${startTime}`);
  const endDate = new Date(`${date} ${endTime}`);

  const event = calendar.getEvents(startDate, endDate).find((event) => isEventGuest(event, userEmail));
  if (!event) return;
  event.deleteEvent();
};

import { GasWebClient as SlackClient } from "@hi-se/web-api";
import { format, addWeeks } from "date-fns";
type OperationType = "registration" | "modificationAndDeletion" | "showEvents";

export const shiftChanger = (e: GoogleAppsScript.Events.DoPost) => {
  const operationType = e.parameter.operationType;
  const userEmail = e.parameter.userEmail;
  const spreadsheetUrl = e.parameter.spreadsheetUrl;
  switch (operationType) {
    case "registration": {
      registration(operationType, userEmail, spreadsheetUrl);
      break;
    }
    case "modificationAndDeletion": {
      modificationAndDeletion(operationType, userEmail, spreadsheetUrl);
      break;
    }
    case "showEvents": {
      showEvents(userEmail, spreadsheetUrl);
      break;
    }
  }
  return;
};

const registration = (operationType: OperationType, userEmail: string, spreadsheetUrl: string) => {
  const shiftInfos = getShiftInfos(operationType, spreadsheetUrl);
  if (shiftInfos === undefined) return;

  const slackAccessToken = PropertiesService.getScriptProperties().getProperty("SLACK_ACCESS_TOKEN");
  if (!slackAccessToken) throw new Error("SLACK_ACCESS_TOKEN is not defined");
  const client = getSlackClient(slackAccessToken);
  const slackMemberProfiles = getSlackMemberProfiles(client);

  const registrationInfos = shiftInfos.map((shiftInfo) => {
    const date = format(shiftInfo[0], "yyyy-MM-dd");
    const startTime = format(shiftInfo[1], "HH:mm");
    const endTime = format(shiftInfo[2], "HH:mm");
    const startDate = new Date(`${date} ${startTime}`);
    const endDate = new Date(`${date} ${endTime}`);
    const title = createTitleFromShiftInfo(shiftInfo, userEmail, slackMemberProfiles);
    return { title: title, startDate: startDate, endDate: endDate };
  });

  registrationInfos.forEach((registrationInfo) => {
    registerEvent(registrationInfo, userEmail);
  });

  const slackChannelToPost = PropertiesService.getScriptProperties().getProperty("SLACK_CHANNEL_TO_POST");
  if (!slackChannelToPost) throw new Error("SLACK_CHANNEL_TO_POST is not defined");

  const messageToNotify = createRegistrationMessage(registrationInfos);
  postMessageToSlackChannel(client, slackChannelToPost, messageToNotify);
};

const getShiftInfos = (operationType: OperationType, spreadsheetUrl: string) => {
  switch (operationType) {
    case "registration": {
      const sheet = getSheet(operationType, spreadsheetUrl);
      const lastRowNum = sheet.getLastRow();
      const shiftInfos = sheet.getRange(2, 1, lastRowNum - 1, 6).getValues();
      return shiftInfos;
    }

    case "modificationAndDeletion": {
      const sheet = getSheet(operationType, spreadsheetUrl);
      const lastRowNum = sheet.getLastRow();
      const shiftInfos = sheet.getRange(6, 5, lastRowNum - 5, 6).getValues();
      return shiftInfos;
    }
  }
};

const getCalendar = () => {
  const calendarId = PropertiesService.getScriptProperties().getProperty("CALENDAR_ID");
  if (!calendarId) throw new Error("ID is not defined");
  const calendar = CalendarApp.getCalendarById(calendarId);
  return calendar;
};

const getNameFromEmail = (email: string, slackMemberProfiles: { name: string; email: string }[]): string => {
  const slackMember = slackMemberProfiles.find((slackMemberProfile) => slackMemberProfile.email === email);
  if (!slackMember) throw new Error("The email is non-slack member");
  return slackMember.name;
};

const getSlackMemberProfiles = (client: SlackClient): { name: string; email: string }[] => {
  const response = client.users.list();
  const slackMembers = response.members;
  if (!slackMembers) throw new Error("SLACK_MEMBERS is not defined");

  const siiiboSlackMembers = slackMembers.filter(
    (slackMember) =>
      !slackMember.deleted &&
      !slackMember.is_bot &&
      slackMember.id !== "USLACKBOT" &&
      slackMember.profile?.email?.match("siiibo.com")
  );

  const slackMemberProfiles = siiiboSlackMembers
    .map((slackMember) => {
      return {
        name: slackMember.profile?.real_name,
        email: slackMember.profile?.email,
      };
    })
    .filter((s): s is { name: string; email: string } => s.name !== "" || s.email !== "");
  return slackMemberProfiles;
};

const getSlackClient = (slackToken: string): SlackClient => {
  return new SlackClient(slackToken);
};

const getJob = (nameRegex: RegExp): string | undefined => {
  // 人対職種データベース
  const spreadSheetUrl = "https://docs.google.com/spreadsheets/d/1g-n_RL7Rou8chG3n_GOyieBbtPTl6eTkDsGQLRWXKbI/edit";
  const sheet = SpreadsheetApp.openByUrl(spreadSheetUrl).getSheetByName("シート1");
  if (!sheet) throw new Error("SHEET is not defined");
  const lastRowNum = sheet.getLastRow();
  const jobInfos = sheet.getRange(1, 1, lastRowNum, 2).getValues();
  const jobInfo = jobInfos.find((jobInfo) => jobInfo[1].match(nameRegex));
  if (jobInfo === undefined) return;

  const job = jobInfo[0];
  return job;
};

const getSheet = (operationType: OperationType, spreadsheetUrl: string): GoogleAppsScript.Spreadsheet.Sheet => {
  const today = format(new Date(), "yyyy-MM-dd");
  const sheet = SpreadsheetApp.openByUrl(spreadsheetUrl)
    .getSheets()
    .find((sheet) => sheet.getDeveloperMetadata()[0].getKey() === `${today}-${operationType}`);

  if (!sheet) throw new Error("SHEET is not defined");

  return sheet;
};

const createTitleFromShiftInfo = (
  shiftInfo: any[],
  userEmail: string,
  slackMemberProfiles: {
    name: string;
    email: string;
  }[]
): string => {
  const name = getNameFromEmail(userEmail, slackMemberProfiles);
  const nameRegex = new RegExp(name.replace(/ |\u3000/g, "( |\u3000|)?"));
  const job = getJob(nameRegex);

  const workingStyle = shiftInfo[5];

  if (shiftInfo[3] === "" || shiftInfo[4] === "") {
    const title = `【${workingStyle}】${job}: ${name}さん`;
    return title;
  } else {
    const restStartTime = format(shiftInfo[3], "HH:mm");

    const restEndTime = format(shiftInfo[4], "HH:mm");

    const title = `【${workingStyle}】${job}: ${name}さん (休憩: ${restStartTime}~${restEndTime})`;
    return title;
  }
};
const registerEvent = (registrationInfo: { title: string; startDate: Date; endDate: Date }, userEmail: string) => {
  const title = registrationInfo.title;
  const startDate = registrationInfo.startDate;
  const endDate = registrationInfo.endDate;
  const calendar = getCalendar();

  calendar.createEvent(title, startDate, endDate, { guests: userEmail });
};
const isEventGuest = (event: GoogleAppsScript.Calendar.CalendarEvent, email: string) => {
  const guestEmails = event.getGuestList().map((guest) => guest.getEmail());
  return guestEmails.indexOf(email) !== -1;
};

const showEvents = (userEmail: string, spreadsheetUrl: string) => {
  const operationType = "modificationAndDeletion";
  const sheet = getSheet(operationType, spreadsheetUrl);

  const startDate = sheet.getRange("A2").getValue();
  const endDate = addWeeks(startDate, 1);
  const calendar = getCalendar();
  const events = calendar.getEvents(startDate, endDate).filter((event) => isEventGuest(event, userEmail));

  if (events.length === 0) {
    return;
  }
  const lastRow = sheet.getLastRow();
  const dataRow = lastRow - 6 + 1;
  const dataColumn = sheet.getLastColumn();

  sheet.getRange(6, 1, dataRow, dataColumn).clearContent();
  const eventsInfo = events.map((event) => {
    const title = event.getTitle();
    const date = Utilities.formatDate(event.getStartTime(), "JST", "MM/dd");
    const startTime = Utilities.formatDate(event.getStartTime(), "JST", "HH:mm");
    const endTime = Utilities.formatDate(event.getEndTime(), "JST", "HH:mm");
    return [title, date, startTime, endTime];
  });
  sheet.getRange(6, 1, eventsInfo.length, eventsInfo[0].length).setValues(eventsInfo);
};

const modificationAndDeletion = (operationType: OperationType, userEmail: string, spreadsheetUrl: string) => {
  const slackAccessToken = PropertiesService.getScriptProperties().getProperty("SLACK_ACCESS_TOKEN");
  if (!slackAccessToken) throw new Error("SLACK_ACCESS_TOKEN is not defined");
  const client = getSlackClient(slackAccessToken);

  modification(operationType, userEmail, spreadsheetUrl, client);
  deletion(operationType, userEmail, spreadsheetUrl, client);
};
const deletion = (operationType: OperationType, userEmail: string, spreadsheetUrl: string, client: SlackClient) => {
  // getShiftInfo
  const sheet = getSheet(operationType, spreadsheetUrl);
  const lastRow = sheet.getLastRow();
  const dataRow = lastRow - 6 + 1;
  const dataColumn = sheet.getLastColumn();

  const selectedEventInfos = sheet
    .getRange(6, 1, dataRow, dataColumn)
    .getValues()
    .filter((event) => event[10])
    .map((eventInfo) => {
      const title = eventInfo[0];
      const date = format(eventInfo[1], "yyyy-MM-dd");
      const startTime = format(eventInfo[2], "HH:mm");
      const endTime = format(eventInfo[3], "HH:mm");
      const startDate = new Date(`${date} ${startTime}`);
      const endDate = new Date(`${date} ${endTime}`);
      return { title: title, startDate: startDate, endDate: endDate };
    });
  const calendar = getCalendar();
  selectedEventInfos.forEach((eventInfo) => deleteEvent(eventInfo, calendar, userEmail));

  const slackChannelToPost = PropertiesService.getScriptProperties().getProperty("SLACK_CHANNEL_TO_POST");
  if (!slackChannelToPost) throw new Error("SLACK_CHANNEL_TO_POST is not defined");

  const messageToNotify = createDeletionMessage(selectedEventInfos);
  postMessageToSlackChannel(client, slackChannelToPost, messageToNotify);
};

const deleteEvent = (
  eventInfo: { title: string; startDate: Date; endDate: Date },
  calendar: GoogleAppsScript.Calendar.Calendar,
  userEmail: string
) => {
  const event = calendar
    .getEvents(eventInfo.startDate, eventInfo.endDate)
    .find((event) => isEventGuest(event, userEmail));
  if (event === undefined) return;
  event.deleteEvent();
};

const modification = (operationType: OperationType, userEmail: string, spreadsheetUrl: string, client: SlackClient) => {
  const slackMemberProfiles = getSlackMemberProfiles(client);
  const sheet = getSheet(operationType, spreadsheetUrl);
  const lastRowNum = sheet.getLastRow();
  const selectedEventInfos = sheet
    .getRange(6, 1, lastRowNum - 5, 12)
    .getValues()
    .filter((event) => event[4])
    .map((eventInfo) => {
      const previousEventInfo = eventInfo.slice(0, 4);
      const title = previousEventInfo[0];
      const date = format(previousEventInfo[1], "yyyy-MM-dd");
      const startTime = format(previousEventInfo[2], "HH:mm");
      const endTime = format(previousEventInfo[3], "HH:mm");
      const startDate = new Date(`${date} ${startTime}`);
      const endDate = new Date(`${date} ${endTime}`);
      const newEventInfo = eventInfo.slice(4, 10);
      const newTitle = createTitleFromShiftInfo(newEventInfo, userEmail, slackMemberProfiles);
      const newDate = format(newEventInfo[0], "yyyy-MM-dd");
      const newStartTime = format(newEventInfo[1], "HH:mm");
      const newEndTime = format(newEventInfo[2], "HH:mm");
      const newStartDate = new Date(`${newDate} ${newStartTime}`);
      const newEndDate = new Date(`${newDate} ${newEndTime}`);
      return {
        previousEventInfo: { title: title, startDate: startDate, endDate: endDate },
        newEventInfo: { title: newTitle, startDate: newStartDate, endDate: newEndDate },
      };
    });

  const calendar = getCalendar();

  console.log("selectedEventInfos", selectedEventInfos);
  selectedEventInfos.forEach((eventInfo) => modifyEvent(eventInfo, calendar, userEmail));
  const slackChannelToPost = PropertiesService.getScriptProperties().getProperty("SLACK_CHANNEL_TO_POST");
  if (!slackChannelToPost) throw new Error("SLACK_CHANNEL_TO_POST is not defined");

  const messageToNotify = createModificationMessage(selectedEventInfos);
  postMessageToSlackChannel(client, slackChannelToPost, messageToNotify);
};

const modifyEvent = (
  eventInfo: {
    previousEventInfo: { title: string; startDate: Date; endDate: Date };
    newEventInfo: { title: string; startDate: Date; endDate: Date };
  },
  calendar: GoogleAppsScript.Calendar.Calendar,
  userEmail: string
) => {
  console.log("eventInfo", eventInfo);

  // getPreviousEventInfo
  const startDate = eventInfo.previousEventInfo.startDate;
  const endDate = eventInfo.previousEventInfo.endDate;

  // getNewEventInfo
  const newTitle = eventInfo.newEventInfo.title;
  const newStartDate = eventInfo.newEventInfo.startDate;
  const newEndDate = eventInfo.newEventInfo.endDate;

  const event = calendar.getEvents(startDate, endDate).find((event) => isEventGuest(event, userEmail));
  console.log("event", event);
  if (event === undefined) return;
  event.setTime(newStartDate, newEndDate);

  event.setTitle(newTitle);
};

const postMessageToSlackChannel = (client: SlackClient, slackChannelToPost: string, messageToNotify: string) => {
  console.log("slackChannelToPost", slackChannelToPost);
  client.chat.postMessage({
    channel: slackChannelToPost,
    text: messageToNotify,
  });
};

// 一個にまとめたい
const createRegistrationMessage = (registrationInfos: { title: string; startDate: Date; endDate: Date }[]): string => {
  const messages = registrationInfos.map((registrationInfo) => {
    const startTime = format(registrationInfo.startDate, "HH:mm");
    const endTime = format(registrationInfo.endDate, "HH:mm");
    const date = format(registrationInfo.startDate, "MM/dd");
    return `${registrationInfo.title}: ${date} ${startTime}~${endTime}`;
  });
  const messageTitle = "以下の予定が追加されました。\n";
  return messageTitle + messages.join("\n");
};

const createDeletionMessage = (selectedEventInfos: { title: string; startDate: Date; endDate: Date }[]): string => {
  const messages = selectedEventInfos.map((eventInfo) => {
    const startTime = format(eventInfo.startDate, "HH:mm");
    const endTime = format(eventInfo.endDate, "HH:mm");
    const date = format(eventInfo.startDate, "MM/dd");
    return `${eventInfo.title}: ${date} ${startTime}~${endTime}`;
  });
  const messageTitle = "以下の予定が削除されました。\n";
  return messageTitle + messages.join("\n");
};

const createModificationMessage = (
  selectedEventInfos: {
    previousEventInfo: {
      title: string;
      startDate: Date;
      endDate: Date;
    };
    newEventInfo: {
      title: string;
      startDate: Date;
      endDate: Date;
    };
  }[]
): string => {
  const messages = selectedEventInfos.map((eventInfo) => {
    const startTime = format(eventInfo.previousEventInfo.startDate, "HH:mm");
    const endTime = format(eventInfo.previousEventInfo.endDate, "HH:mm");
    const date = format(eventInfo.previousEventInfo.startDate, "MM/dd");

    const newStartTime = format(eventInfo.newEventInfo.startDate, "HH:mm");
    const newEndTime = format(eventInfo.newEventInfo.endDate, "HH:mm");
    const newDate = format(eventInfo.newEventInfo.startDate, "MM/dd");

    return `${eventInfo.previousEventInfo.title}: ${date} ${startTime}~${endTime}\n\
    → ${eventInfo.newEventInfo.title}: ${newDate} ${newStartTime}~${newEndTime}`;
  });
  const messageTitle = "以下の予定が変更されました。\n";
  return messageTitle + messages.join("\n");
};

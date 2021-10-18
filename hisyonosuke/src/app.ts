import { SlackAction, SlackEvent, SlackShortcut, SlackViewAction } from '@slack/bolt';
import { birthdayRegistrator } from './birthday-registrator/birthday-registrator';
import { workflowCustomStep } from './workflow-customstep/workflow-customstep';
import { notificator } from './notificator'

const doPost = (e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput => {
  if (isUrlVerification(e)) {
    return ContentService.createTextOutput(JSON.parse(e.postData.contents)['challenge']);
  }

  const response = birthdayRegistrator(e); // FIXME: レスポンスの書き換えが生じないようにとりあえずconstで定義してある
  workflowCustomStep(e);

  return ContentService.createTextOutput(response).setMimeType(ContentService.MimeType.JSON);
}

const isJson = (e: GoogleAppsScript.Events.DoPost): boolean => {
  return e.postData.type === 'application/json';
}

const isUrlVerification = (e: GoogleAppsScript.Events.DoPost): boolean => {
  if (isJson(e) && e.postData.contents) {
    return (JSON.parse(e.postData.contents).type === 'url_verification');
  } else {
    return false;
  }
}

const isAction = (e: GoogleAppsScript.Events.DoPost): boolean => {
  if (e.parameter.hasOwnProperty('payload')) {
    const type = JSON.parse(e.parameter['payload'])['type'];
    return type === 'block_actions' || type === 'workflow_step_edit';
  }
  return false;
}

const isViewAction = (e: GoogleAppsScript.Events.DoPost): boolean => {
  if (e.parameter.hasOwnProperty('payload')) {
    const type = JSON.parse(e.parameter['payload'])['type'];
    return type === 'view_submission' || type === 'view_closed';
  }
  return false;
}

const isShortcut = (e: GoogleAppsScript.Events.DoPost): boolean => {
  if (e.parameter.hasOwnProperty('payload')) {
    const type = JSON.parse(e.parameter['payload'])['type'];
    return type === 'shortcut';
  }
  return false;
}

const isEvent = (e: GoogleAppsScript.Events.DoPost): boolean => {
  if (isJson(e) && e.postData.contents) {
    return JSON.parse(e.postData.contents).hasOwnProperty('event');
  }
  return false;
}

export const getTypeAndCallbackId = (e: GoogleAppsScript.Events.DoPost): { type: string, callback_id: string } => {
  // FIXME: この関数は使わない方向に修正していく
  // 詳細は https://github.com/siiibo/hisyonosuke/pull/1 参照
  if (isAction(e)) {
    const payload = JSON.parse(e.parameter['payload']) as SlackAction;
    switch (payload.type) {
      case 'block_actions':
        return { type: payload.type, callback_id: payload.view.callback_id }
      case 'workflow_step_edit':
        return { type: payload.type, callback_id: payload.callback_id };
    }
  } else if (isViewAction(e)) {
    const payload = JSON.parse(e.parameter['payload']) as SlackViewAction;
    switch (payload.type) {
      case 'view_submission':
        return { type: payload.type, callback_id: payload.view.callback_id };
      case 'view_closed':
        return { type: payload.type, callback_id: payload.view.callback_id };
    }
  } else if (isShortcut(e)) {
    const payload = JSON.parse(e.parameter['payload']) as SlackShortcut;
    switch (payload.type) {
      case 'shortcut':
        return { type: payload.type, callback_id: payload.callback_id }
      case 'message_action':
        return { type: payload.type, callback_id: payload.callback_id }
    }
  } else if (isEvent(e)) {
    const payload = JSON.parse(e.postData.contents).event as SlackEvent;
    switch (payload.type) {
      case 'workflow_step_execute':
        return { type: payload.type, callback_id: payload.callback_id };
    }
  }
}

const init = () => {
  initProperties();
}

const initProperties = () => {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CONFIG');
  const rows = sheet.getDataRange().getValues();
  let properties = {};
  for (let row of rows.slice(1)) properties[row[0]] = row[1];

  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.deleteAllProperties();
  scriptProperties.setProperties(properties);
}

declare const global: any;
global.doPost = doPost;
global.init = init;
global.notificator = notificator;

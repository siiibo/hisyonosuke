import { WorkflowStepEdit } from '@slack/bolt';
import { WorkflowStepExecuteEvent } from '@slack/bolt';
import { ViewWorkflowStepSubmitAction } from '@slack/bolt';
import { GasWebClient as SlackClient } from '@hi-se/web-api';
import { ViewsOpenArguments, WorkflowsUpdateStepArguments } from '@hi-se/web-api/src/methods';
import { getTypeAndCallbackId } from '../app';
import * as modals from './modals';


export const workflowCustomStep = (e: GoogleAppsScript.Events.DoPost) => {
  const client = getSlackClient();
  const { type, callback_id } = getTypeAndCallbackId(e);

  if (type == 'workflow_step_edit') {
    const payload = JSON.parse(e.parameter['payload']);
    editWorkflowStep(client, payload);
  }
  else if (type == 'view_submission') {
    const payload = JSON.parse(e.parameter['payload']);
    saveWorkflowStep(client, payload);
  }
  else if (type == 'workflows_step_execute') {
    const payload = JSON.parse(e.postData.contents).hasOwnProperty('event');
    registerCompany(client, payload);
  }

}

const getSlackClient = (): SlackClient => {
  const token: string = PropertiesService.getScriptProperties().getProperty('SLACK_TOKEN');
  return new SlackClient(token);
}

const editWorkflowStep = (client: SlackClient, payload: WorkflowStepEdit): string => {
  const data: ViewsOpenArguments = {
    'trigger_id': payload.trigger_id,
    'token': PropertiesService.getScriptProperties().getProperty('SLACK_TOKEN'),
    'view': modals.editStepModal(),
  };

  client.views.open(data);
  return '';
}

const saveWorkflowStep = (client: SlackClient, payload: ViewWorkflowStepSubmitAction) => {
  const options: WorkflowsUpdateStepArguments = {
    'workflow_step_edit_id': payload.workflow_step.workflow_step_edit_id,
    'token': PropertiesService.getScriptProperties().getProperty('SLACK_TOKEN'),
    'inputs': {
      'company_name': { 'value': payload.view.state.values.company_name.value.value },
      'market_division': { 'value': payload.view.state.values.market_division.value.value },
    },
    'outputs': [],
  }
  client.workflows.updateStep(options);
  return '';
}

const registerCompany = (client: SlackClient, payload: WorkflowStepExecuteEvent) => {
  const prop = PropertiesService.getScriptProperties().getProperties();
  const spreadsheet = SpreadsheetApp.openById(prop.IR_SPREADSHEET_ID);
  const sheet = spreadsheet.getSheets()[0];

  const companyName = payload.workflow_step.inputs.company_name.value;
  const marketDivision = payload.workflow_step.inputs.market_division.value;
  const lastRow = sheet.getLastRow() + 1;

  const targetRange = sheet.getRange(2, 1, lastRow, 1)

  const textFinder = targetRange.createTextFinder(companyName)
    .ignoreDiacritics(true)
    .matchCase(true)
    .matchEntireCell(true)
    .matchFormulaText(true);

  if (textFinder.findAll().length == 0) {
    const values = [[companyName, marketDivision]];
    sheet.getRange(lastRow, 1, 1, 2).setValues(values);
  }

  client.workflows.stepCompleted(
    {
      token: prop.SLACK_TOKEN,
      workflow_step_execute_id: payload.workflow_step.workflow_step_execute_id,
    }
  )

  return '';
}

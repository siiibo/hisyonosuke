import { GlobalShortcut, BlockAction } from "@slack/bolt"
import { GasWebClient as SlackClient } from '@hi-se/web-api';
import { ViewsOpenArguments, ViewsPushArguments, ViewsUpdateArguments } from '@hi-se/web-api/src/methods';
import {select, register} from './modals'



export const doPost = (e: GoogleAppsScript.Events.DoPost) => {
    const parameter = e.parameter
    console.log("parameter", parameter)
    const slackToken = PropertiesService.getScriptProperties().getProperty('SLACK_TOKEN');
    if (!slackToken) throw new Error("SLACK_TOKEN is not defined");
    const slackAccessToken = PropertiesService.getScriptProperties().getProperty('SLACK_ACCESS_TOKEN');
    if (!slackAccessToken) throw new Error("SLACK_ACCESS_TOKEN is not defined");
    const client = getSlackClient(slackToken);

    try {
      if(!parameter.payload) { //　最初のやつ
  
        if (slackToken != parameter.token) throw new Error(parameter.token)
  
        console.log('modalOpen');
        return openModal(client, JSON.parse(parameter.payload), slackAccessToken) // スラッシュコマンドの時はモーダルをOpen
        
      } else{
        const payload = JSON.parse(decodeURIComponent(parameter.payload))
        console.log("payload", payload)
    
        if (slackToken != payload.token) throw new Error(payload.token)
  
        if (!payload.actions){ //アクション (ボタン押し) がない → モーダルの回答
          console.log("it has no action")
          // registrationの回答
          console.log("username", payload.user.username);
          const formValues = payload.view.state.values;
          console.log("formValues", formValues);
          console.log("date", formValues.date['datepicker-action'].selected_date);
          console.log("start time", formValues.start_time['timepicker-action'].selected_time);
          console.log("end time", formValues.end_time['timepicker-action'].selected_time);
          console.log("working_style", formValues.working_style['static_select-action'].selected_option.text.text);
  
          // startTimeとendTimeの定義
          const date_ = formValues.date['datepicker-action'].selected_date;
          const year = date_.split("-")[0];
          const month = date_.split("-")[1].toString()-1;
          const date = date_.split("-")[2];
  
          const startTime_ = formValues.start_time['timepicker-action'].selected_time;
          const startMinute = startTime_.split(":")[0];
          const startSecond = startTime_.split(":")[1];
          const startTime = new Date(year, month, date, startMinute, startSecond);
          console.log("startTime", startTime);
          const endTime_ = formValues.end_time['timepicker-action'].selected_time;
          const endMinute = endTime_.split(":")[0];
          const endSecond = endTime_.split(":")[1];
          const endTime = new Date(year, month, date, endMinute, endSecond);
          console.log("endTime", endTime);
  
          registerCalendar(startTime, endTime);
          
          return ContentService.createTextOutput('')}
  
        console.log("actionId: ", payload.actions[0].action_id)
  
        // アクション (ボタン押し) がある
        if (payload.actions[0].action_id === 'registration'){
  
          console.log("registration")
          return updateModal(client, payload, slackAccessToken)
        }
  
      }
    } catch(error) {
      return ContentService.createTextOutput('403')
    }
  }
  
  const registerCalendar = (startTime: Date, endTime: Date) => {
    const ID = 'yukiko.orui@siiibo.com' //ID = メアド
    const calendar = CalendarApp.getCalendarById(ID);
    const title = '【リモート】Tech大類さん' // 回答内容から生成
    // 
    calendar.createEvent(title, startTime, endTime)
  }
  
  declare const global: any;
  global.doPost = doPost;
  


const openModal = (client: SlackClient, payload: GlobalShortcut, slackAccessToken: string) =>{
    
    const modalView = select()
    const viewData: ViewsOpenArguments  = {
      token: slackAccessToken,
      trigger_id: payload.trigger_id,
      view: modalView
    };
    client.views.open(viewData);

    // const postUrl = 'https://slack.com/api/views.open'
    // const viewDataPayload = JSON.stringify(viewData)
    // const options = {
    //   'method': "post",
    //   'contentType': "application/json",
    //   'headers': {"Authorization": `Bearer ${slackAccessToken}`},
    //   'payload': viewDataPayload
    // }
  
    // UrlFetchApp.fetch(postUrl, options)

    return ContentService.createTextOutput()
  }
  
const pushModal = (client: SlackClient, payload: BlockAction, slackAccessToken: string) =>{

    const modalView = register()
    const viewData: ViewsPushArguments = {
      token: slackAccessToken,
      trigger_id: payload.trigger_id,
      view: modalView
    }
    client.views.open(viewData);

    // const postUrl = 'https://slack.com/api/views.push'
    // const viewDataPayload = JSON.stringify(viewData)
    // const options = {
    //   method: "post",
    //   contentType: "application/json",
    //   headers: {"Authorization": `Bearer ${slackAccessToken}`},
    //   payload: viewDataPayload
    // }
  
    return ContentService.createTextOutput()
  }
  
const updateModal = (client: SlackClient, payload: BlockAction, slackAccessToken: string) =>{
    
    const modalView = register()
    const viewId = payload.view?.id
    const viewData: ViewsUpdateArguments = {
      token: slackAccessToken,
      view_id: viewId,// updateの場合は上書きするviewIdを指定してあげないといけない
      trigger_id: payload.trigger_id,
      view: modalView
    }
    client.views.update(viewData);

    // const postUrl = 'https://slack.com/api/views.update'
    // const viewDataPayload = JSON.stringify(viewData)
    // const options = {
    //   method: "post",
    //   contentType: "application/json",
    //   headers: {"Authorization": `Bearer ${slackAccessToken}`},
    //   payload: viewDataPayload
    // }
  
    // UrlFetchApp.fetch(postUrl, options)

    return ContentService.createTextOutput()
  }
const getSlackClient = (slackToken: string): SlackClient => {
    return new SlackClient(slackToken);
  }
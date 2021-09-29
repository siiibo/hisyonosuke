import {
    ChatPostMessageArguments,
    ChatScheduleMessageArguments,
    UsersLookupByEmailArguments
} from '@slack/web-api'

const SLACK_AUTH_TOKEN = PropertiesService.getScriptProperties().getProperty('SLACK_TOKEN');



type FetchMethod = 'get' | 'delete' | 'patch' | 'post' | 'put';
interface Params {
    method: FetchMethod,
    payload?: Object
}

function getUserIdByEmail(args: UsersLookupByEmailArguments) {
    const URL = 'https://slack.com/api/users.lookupByEmail';
    const payload = {
        token: SLACK_AUTH_TOKEN,
        email: args
    }

    const params: Params = {
        method: 'get',
        payload: payload
    }

    const response = JSON.parse(UrlFetchApp.fetch(URL, params).getContentText());

    if (response.hasOwnProperty('user')) {
        return response.user.id;
    } else {
        return false;
    }
}

function sendMessage(args: ChatPostMessageArguments) {
    const URL = 'https://slack.com/api/chat.postMessage';
    let payload = {
        token: SLACK_AUTH_TOKEN
    }
    payload = { ...payload, ...args }
    const params: Params = {
        method: 'post',
        payload: payload
    }
    UrlFetchApp.fetch(URL, params);
}

function sendScheduleMessage(args: ChatScheduleMessageArguments) {
    const URL = 'https://slack.com/api/chat.scheduleMessage';
    let payload = {
        token: SLACK_AUTH_TOKEN,
    }
    payload = { ...payload, ...args }
    const params: Params = {
        method: 'post',
        payload: payload
    }
    UrlFetchApp.fetch(URL, params);
}

export {
    getUserIdByEmail,
    sendMessage,
    sendScheduleMessage
}

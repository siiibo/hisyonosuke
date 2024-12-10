import { getConfig } from "./config";

export function printAuthUrl() {
  const authUrl = getService().getAuthorizationUrl();
  console.log(authUrl);
}

export function getService() {
  const { FREEE_CLIENT_ID: CLIENT_ID, FREEE_CLIENT_SECRET: CLIENT_SECRET } = getConfig();
  return OAuth2.createService("freee")
    .setAuthorizationBaseUrl("https://accounts.secure.freee.co.jp/public_api/authorize")
    .setTokenUrl("https://accounts.secure.freee.co.jp/public_api/token")
    .setClientId(CLIENT_ID)
    .setClientSecret(CLIENT_SECRET)
    .setCallbackFunction(authCallback.name)
    .setPropertyStore(PropertiesService.getScriptProperties());
}

export function authCallback(request: object) {
  const service = getService();
  const isAuthorized = service.handleCallback(request);
  console.log(`Effective User: ${Session.getEffectiveUser().getEmail()}`);
  if (isAuthorized) {
    return HtmlService.createHtmlOutput("認証に成功しました。タブを閉じてください。");
  }
  return HtmlService.createHtmlOutput("認証に失敗しました。");
}

export function printAuth() {
  const props = PropertiesService.getScriptProperties().getProperties();
  console.log(props);
  console.log(PropertiesService.getScriptProperties().getProperties());
}

export function resetAuth() {
  getService().reset();
}

import { init, main, onUserConfigSheetOpen } from "./main";

/**
 * @file GASエディタから実行できる関数を定義する
 */

declare const global: any;
global.main = main;
global.init = init;
global.onUserConfigSheetOpen = onUserConfigSheetOpen;

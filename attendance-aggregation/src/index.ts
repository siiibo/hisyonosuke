import { main, init, onUserConfigSheetOpen } from './main';

/**
 * @file GASエディタから実行できる関数を定義する
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const global: any;
global.main = main;
global.init = init;
global.onUserConfigSheetOpen = onUserConfigSheetOpen;


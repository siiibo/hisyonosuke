import { doPost, init } from "./app";
import { notificator } from "./notificator";
import { periodicallyCheckForAttendanceManager } from "./attendance-manager/attendanceManager";

/**
 * @file GASエディタから実行できる関数を定義する
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const global: any;
global.doPost = doPost;
global.init = init;
global.notificator = notificator;
global.periodicallyCheckForAttendanceManager = periodicallyCheckForAttendanceManager;

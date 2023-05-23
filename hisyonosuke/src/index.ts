import { doPost, init } from "./app";
import { notificator } from "./birthday-registrator/notificator";
import { periodicallyCheckForAttendanceManager } from "./attendance-manager/attendanceManager";
import { notifyPartTimerShift } from "./part-timer-shift/notify";

/**
 * @file GASエディタから実行できる関数を定義する
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const global: any;
global.doPost = doPost;
global.init = init;
global.notificator = notificator;
global.periodicallyCheckForAttendanceManager = periodicallyCheckForAttendanceManager;
global.notifyPartTimerShift = notifyPartTimerShift;

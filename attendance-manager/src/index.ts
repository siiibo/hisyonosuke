/**
 * @file GASエディタから実行できる関数を定義する
 */

import {
  initAttendanceManager,
  initAutoClockOut,
  manageForgottenClockOut,
  periodicallyCheckForAttendanceManager,
} from "./attendanceManager";

// biome-ignore lint/suspicious/noExplicitAny: any is used to declare global
declare const global: any;
global.initAttendanceManager = initAttendanceManager;
global.periodicallyCheckForAttendanceManager = periodicallyCheckForAttendanceManager;
global.initAutoClockOut = initAutoClockOut;
global.manageForgottenClockOut = manageForgottenClockOut;

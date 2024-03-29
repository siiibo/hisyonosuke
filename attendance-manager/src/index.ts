/**
 * @file GASエディタから実行できる関数を定義する
 */

import {
  periodicallyCheckForAttendanceManager,
  initAttendanceManager,
  initAutoClockOut,
  manageForgottenClockOut,
} from "./attendanceManager";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const global: any;
global.initAttendanceManager = initAttendanceManager;
global.periodicallyCheckForAttendanceManager = periodicallyCheckForAttendanceManager;
global.initAutoClockOut = initAutoClockOut;
global.manageForgottenClockOut = manageForgottenClockOut;

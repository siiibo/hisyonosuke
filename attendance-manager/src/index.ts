/**
 * @file GASエディタから実行できる関数を定義する
 */

import {
  initAttendanceManager,
  initAutoClockOut,
  manageForgottenClockOut,
  periodicallyCheckForAttendanceManager,
} from "./attendanceManager";

declare const global: any;
global.initAttendanceManager = initAttendanceManager;
global.periodicallyCheckForAttendanceManager = periodicallyCheckForAttendanceManager;
global.initAutoClockOut = initAutoClockOut;
global.manageForgottenClockOut = manageForgottenClockOut;

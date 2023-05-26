// import { doPost, init } from "./app";
import { notificator } from "./birthday-registrator/notificator";
import { periodicallyCheckForAttendanceManager } from "./attendance-manager/attendanceManager";
import { notifyPartTimerShift } from "./part-timer-shift/notify";
import {
  doPost,
  // init,
  onOpen,
  callRegistration,
  callShowEvents,
  callModificationAndDeletion,
  insertRegistrationSheet,
  insertModificationAndDeletionSheet,
  // onInstall,
} from "./shift-changer/shift-changer";
/**
 * @file GASエディタから実行できる関数を定義する
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const global: any;
// global.doPost = doPost;
// global.init = init;
// global.notificator = notificator;
// global.periodicallyCheckForAttendanceManager = periodicallyCheckForAttendanceManager;

global.doPost = doPost;
// global.init = init;
// global.onInstall = onInstall;
global.onOpen = onOpen;
global.callRegistration = callRegistration;
global.callShowEvents = callShowEvents;
global.callModificationAndDeletion = callModificationAndDeletion;
global.insertRegistrationSheet = insertRegistrationSheet;
global.insertModificationAndDeletionSheet = insertModificationAndDeletionSheet;
global.notifyPartTimerShift = notifyPartTimerShift;

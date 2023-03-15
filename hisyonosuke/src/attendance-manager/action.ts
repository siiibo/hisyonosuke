import { CommandType } from "./command";
import { UserWorkStatus } from "./userWorkStatus";

export type ActionType =
  | "clock_in"
  | "clock_out"
  | "clock_out_and_add_remote_memo"
  | "switch_work_status_to_office"
  | "switch_work_status_to_remote";

export function getActionType(commandType: CommandType, userWorkStatus: UserWorkStatus | undefined): ActionType {
  switch (commandType) {
    case "CLOCK_IN":
      return "clock_in";
    case "CLOCK_IN_AND_ALL_DAY_REMOTE_OR_SWITCH_TO_ALL_DAY_REMOTE":
      // TODO: 勤務中（リモート）だった場合
      return userWorkStatus?.workStatus === "勤務中（出社）" ? "switch_work_status_to_remote" : "clock_in";
    case "CLOCK_IN_OR_SWITCH_TO_OFFICE":
      // TODO: 勤務中（出社）だった場合
      return userWorkStatus?.workStatus === "勤務中（リモート）" ? "switch_work_status_to_office" : "clock_in";
    case "SWITCH_TO_REMOTE":
      return "switch_work_status_to_remote";
    case "CLOCK_OUT":
      //TODO: 打刻の重複の場合
      return userWorkStatus?.needTrafficExpense === false ? "clock_out_and_add_remote_memo" : "clock_out";
  }
}

import { CommandType } from "./command";
import { UserWorkStatus } from "./userWorkStatus";
import { match } from "ts-pattern";
import { valueOf } from "./utilities";

const Actions = {
  CLOCK_IN: "clock_in",
  CLOCK_OUT: "clock_out",
  CLOCK_OUT_AND_ADD_REMOTE_MEMO: "clock_out_and_add_remote_memo",
  SWITCH_TO_OFFICE: "switch_work_status_to_office",
  SWITCH_TO_REMOTE: "switch_work_status_to_remote",
} as const;

export type ActionType = valueOf<typeof Actions>;

export function getActionType(commandType: CommandType, userWorkStatus: UserWorkStatus | undefined): ActionType {
  return match(commandType)
    .with("CLOCK_IN", () => Actions.CLOCK_IN)
    .with("CLOCK_IN_AND_ALL_DAY_REMOTE_OR_SWITCH_TO_ALL_DAY_REMOTE", () => {
      return userWorkStatus?.workStatus === "勤務中（出社）" ? Actions.SWITCH_TO_REMOTE : Actions.CLOCK_IN;
    })
    .with("CLOCK_IN_OR_SWITCH_TO_OFFICE", () => {
      return userWorkStatus?.workStatus === "勤務中（リモート）" ? Actions.SWITCH_TO_OFFICE : Actions.CLOCK_IN;
    })
    .with("SWITCH_TO_REMOTE", () => Actions.SWITCH_TO_REMOTE)
    .with("CLOCK_OUT", () => {
      return userWorkStatus?.needTrafficExpense === false ? Actions.CLOCK_OUT_AND_ADD_REMOTE_MEMO : Actions.CLOCK_OUT;
    })
    .exhaustive();
}

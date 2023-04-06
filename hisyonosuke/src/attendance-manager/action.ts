import { err, ok, Result } from "neverthrow";
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
  BREAK_BEGIN: "break_begin",
  BREAK_END: "break_end",
} as const;

export type ActionType = valueOf<typeof Actions>;

export function getActionType(
  commandType: CommandType,
  userWorkStatus: UserWorkStatus | undefined
): Result<ActionType, { message: string }> {
  return match(userWorkStatus)
    .with(undefined, () => {
      // 未出勤状態
      return match(commandType)
        .with("CLOCK_IN", () => ok(Actions.CLOCK_IN))
        .with("CLOCK_IN_AND_ALL_DAY_REMOTE_OR_SWITCH_TO_ALL_DAY_REMOTE", () => ok(Actions.CLOCK_IN))
        .with("CLOCK_IN_OR_SWITCH_TO_OFFICE", () => ok(Actions.CLOCK_IN))
        .with("SWITCH_TO_REMOTE", () => ok(Actions.SWITCH_TO_REMOTE))
        .with("CLOCK_OUT", () => ok(Actions.CLOCK_OUT))
        .with("BREAK_BEGIN", () => ok(Actions.BREAK_BEGIN))
        .with("BREAK_END", () => ok(Actions.BREAK_END))
        .exhaustive();
    })
    .with({ workStatus: "勤務中（出社）" }, () => {
      return match(commandType)
        .with("CLOCK_IN", () => ok(Actions.CLOCK_IN))
        .with("CLOCK_IN_AND_ALL_DAY_REMOTE_OR_SWITCH_TO_ALL_DAY_REMOTE", () => ok(Actions.SWITCH_TO_REMOTE))
        .with("CLOCK_IN_OR_SWITCH_TO_OFFICE", () => ok(Actions.SWITCH_TO_OFFICE))
        .with("SWITCH_TO_REMOTE", () => ok(Actions.SWITCH_TO_REMOTE))
        .with("CLOCK_OUT", () => ok(Actions.CLOCK_OUT))
        .with("BREAK_BEGIN", () => ok(Actions.BREAK_BEGIN))
        .with("BREAK_END", () => ok(Actions.BREAK_END))
        .exhaustive();
    })
    .with({ workStatus: "勤務中（リモート）", needTrafficExpense: true }, () => {
      return match(commandType)
        .with("CLOCK_IN", () => ok(Actions.CLOCK_IN))
        .with("CLOCK_IN_AND_ALL_DAY_REMOTE_OR_SWITCH_TO_ALL_DAY_REMOTE", () => ok(Actions.SWITCH_TO_REMOTE))
        .with("CLOCK_IN_OR_SWITCH_TO_OFFICE", () => ok(Actions.SWITCH_TO_OFFICE))
        .with("SWITCH_TO_REMOTE", () => ok(Actions.SWITCH_TO_REMOTE))
        .with("CLOCK_OUT", () => ok(Actions.CLOCK_OUT_AND_ADD_REMOTE_MEMO))
        .with("BREAK_BEGIN", () => ok(Actions.BREAK_BEGIN))
        .with("BREAK_END", () => ok(Actions.BREAK_END))
        .exhaustive();
    })
    .with({ workStatus: "勤務中（リモート）", needTrafficExpense: false }, () => {
      return match(commandType)
        .with("CLOCK_IN", () => ok(Actions.CLOCK_IN))
        .with("CLOCK_IN_AND_ALL_DAY_REMOTE_OR_SWITCH_TO_ALL_DAY_REMOTE", () => ok(Actions.SWITCH_TO_REMOTE))
        .with("CLOCK_IN_OR_SWITCH_TO_OFFICE", () => ok(Actions.SWITCH_TO_OFFICE))
        .with("SWITCH_TO_REMOTE", () => ok(Actions.SWITCH_TO_REMOTE))
        .with("CLOCK_OUT", () => ok(Actions.CLOCK_OUT))
        .with("BREAK_BEGIN", () => ok(Actions.BREAK_BEGIN))
        .with("BREAK_END", () => ok(Actions.BREAK_END))
        .exhaustive();
    })
    .with({ workStatus: "休憩中" }, () => {
      return match(commandType)
        .with("CLOCK_IN", () => ok(Actions.CLOCK_IN))
        .with("CLOCK_IN_AND_ALL_DAY_REMOTE_OR_SWITCH_TO_ALL_DAY_REMOTE", () => ok(Actions.SWITCH_TO_REMOTE))
        .with("CLOCK_IN_OR_SWITCH_TO_OFFICE", () => ok(Actions.SWITCH_TO_OFFICE))
        .with("SWITCH_TO_REMOTE", () => ok(Actions.SWITCH_TO_REMOTE))
        .with("CLOCK_OUT", () => ok(Actions.CLOCK_OUT))
        .with("BREAK_BEGIN", () => ok(Actions.BREAK_BEGIN))
        .with("BREAK_END", () => ok(Actions.BREAK_END))
        .exhaustive();
    })
    .with({ workStatus: "退勤済み" }, () => {
      return match(commandType)
        .with("CLOCK_IN", () => ok(Actions.CLOCK_IN))
        .with("CLOCK_IN_AND_ALL_DAY_REMOTE_OR_SWITCH_TO_ALL_DAY_REMOTE", () => ok(Actions.SWITCH_TO_REMOTE))
        .with("CLOCK_IN_OR_SWITCH_TO_OFFICE", () => ok(Actions.SWITCH_TO_OFFICE))
        .with("SWITCH_TO_REMOTE", () => ok(Actions.SWITCH_TO_REMOTE))
        .with("CLOCK_OUT", () => ok(Actions.CLOCK_OUT))
        .with("BREAK_BEGIN", () => ok(Actions.BREAK_BEGIN))
        .with("BREAK_END", () => ok(Actions.BREAK_END))
        .exhaustive();
    })
    .exhaustive();
}

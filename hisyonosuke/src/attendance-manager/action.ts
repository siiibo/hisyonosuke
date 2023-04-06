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
      // 未出勤状態 freeeで直接打刻した場合を考慮して全てのアクションを許容している
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
        .with("CLOCK_IN", () => err({ message: "すでに出勤しています" }))
        .with("CLOCK_IN_AND_ALL_DAY_REMOTE_OR_SWITCH_TO_ALL_DAY_REMOTE", () => ok(Actions.SWITCH_TO_REMOTE))
        .with("CLOCK_IN_OR_SWITCH_TO_OFFICE", () => err({ message: "すでに出社状態です" }))
        .with("SWITCH_TO_REMOTE", () => ok(Actions.SWITCH_TO_REMOTE))
        .with("CLOCK_OUT", () => ok(Actions.CLOCK_OUT))
        .with("BREAK_BEGIN", () => ok(Actions.BREAK_BEGIN))
        .with("BREAK_END", () => ok(Actions.BREAK_END))
        .exhaustive();
    })
    .with({ workStatus: "勤務中（リモート）", needTrafficExpense: true }, () => {
      return match(commandType)
        .with("CLOCK_IN", () => err({ message: "すでに出勤しています" }))
        .with(
          "CLOCK_IN_AND_ALL_DAY_REMOTE_OR_SWITCH_TO_ALL_DAY_REMOTE",
          () => ok(Actions.SWITCH_TO_REMOTE) // 通勤費なしに切り替える
        )
        .with("CLOCK_IN_OR_SWITCH_TO_OFFICE", () => ok(Actions.SWITCH_TO_OFFICE))
        .with("SWITCH_TO_REMOTE", () => err({ message: "すでにリモート状態です" }))
        .with("CLOCK_OUT", () => ok(Actions.CLOCK_OUT_AND_ADD_REMOTE_MEMO))
        .with("BREAK_BEGIN", () => ok(Actions.BREAK_BEGIN))
        .with("BREAK_END", () => ok(Actions.BREAK_END))
        .exhaustive();
    })
    .with({ workStatus: "勤務中（リモート）", needTrafficExpense: false }, () => {
      return match(commandType)
        .with("CLOCK_IN", () => err({ message: "すでに出勤しています" }))
        .with("CLOCK_IN_AND_ALL_DAY_REMOTE_OR_SWITCH_TO_ALL_DAY_REMOTE", () =>
          err({ message: "すでにリモート状態です" })
        )
        .with("CLOCK_IN_OR_SWITCH_TO_OFFICE", () => ok(Actions.SWITCH_TO_OFFICE))
        .with("SWITCH_TO_REMOTE", () => err({ message: "すでにリモート状態です" }))
        .with("CLOCK_OUT", () => ok(Actions.CLOCK_OUT))
        .with("BREAK_BEGIN", () => ok(Actions.BREAK_BEGIN))
        .with("BREAK_END", () => ok(Actions.BREAK_END))
        .exhaustive();
    })
    .with({ workStatus: "休憩中" }, () => {
      return match(commandType)
        .with("BREAK_END", () => ok(Actions.BREAK_END))
        .otherwise(() => err({ message: "休憩を終了してからコマンドを実行してください." }));
    })
    .with({ workStatus: "退勤済み" }, () => {
      return match(commandType)
        .with("CLOCK_OUT", () => ok(Actions.CLOCK_OUT))
        .otherwise(() => err({ message: "すでに退勤済みです" }));
    })
    .exhaustive();
}

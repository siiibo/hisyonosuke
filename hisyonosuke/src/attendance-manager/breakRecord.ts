import {
  addHours,
  millisecondsToMinutes,
  minutesToMilliseconds,
  set,
  addMilliseconds,
  isBefore,
  isAfter,
  format,
  subMilliseconds,
} from "date-fns";
import { match, P } from "ts-pattern";
import { getTotalTimeFromTimeRanges } from "./freee";
import { EmployeesWorkRecordTimeRangeSerializer } from "./freee.schema";
import * as R from "remeda";

export type BreakRecordWithClockInAndOut = EmployeesWorkRecordTimeRangeSerializer & {
  break_records: EmployeesWorkRecordTimeRangeSerializer[];
};

export function calculateBreakTimeMsToAdd({ clock_in_at, clock_out_at, break_records }: BreakRecordWithClockInAndOut) {
  const totalWorkTimeMin = millisecondsToMinutes(getTotalTimeFromTimeRanges([{ clock_in_at, clock_out_at }]));
  const totalBreakTimeMin = millisecondsToMinutes(getTotalTimeFromTimeRanges(break_records));

  const breakTimeToAdd = match([totalWorkTimeMin, totalBreakTimeMin])
    .with(
      P.when(([wT]) => wT > 360 && wT <= 405),
      ([wT, bT]) => wT - 360 - bT
    )
    .with(
      P.when(([wT]) => wT > 405 && wT <= 525),
      ([, bT]) => 45 - bT
    )
    .with(
      P.when(([wT]) => wT > 525 && wT <= 540),
      ([wT, bT]) => wT - 480 - bT
    )
    .with(
      P.when(([wT]) => wT > 540),
      ([, bT]) => 60 - bT
    )
    .otherwise(() => 0);
  return breakTimeToAdd > 0 ? minutesToMilliseconds(breakTimeToAdd) : 0;
}

export const createNewTimeRecord = (startTime: Date, breakDuration: number): EmployeesWorkRecordTimeRangeSerializer => {
  const clock_in_at = startTime;
  const clock_out_at = addMilliseconds(clock_in_at, breakDuration);
  return {
    clock_in_at: format(clock_in_at, "yyyy-MM-dd HH:mm:ss"),
    clock_out_at: format(clock_out_at, "yyyy-MM-dd HH:mm:ss"),
  };
};

// 休憩時間を追加する関数
export function createAdditionalBreakTime(
  workRecord: BreakRecordWithClockInAndOut,
  breakDurationMs: number
): {
  clock_in_at: string;
  clock_out_at: string;
} {
  const [clock_in_at, clock_out_at, break_records] = [
    new Date(workRecord.clock_in_at),
    new Date(workRecord.clock_out_at),
    workRecord.break_records
      .map((breakRecord) => ({
        clock_in_at: new Date(breakRecord.clock_in_at),
        clock_out_at: new Date(breakRecord.clock_out_at),
      }))
      .sort((a, b) => a.clock_in_at.getTime() - b.clock_in_at.getTime()),
  ];
  const PM_1 = set(clock_in_at, { hours: 13, minutes: 0, seconds: 0, milliseconds: 0 });

  if (break_records.length === 0) {
    const newBreakRecord = match([clock_in_at, clock_out_at])
      .with(
        P.when(([clockInAt, clockOutAt]) => isBefore(clockOutAt, PM_1) || isAfter(clockInAt, PM_1)),
        ([clockInAt]) => {
          return createNewTimeRecord(addHours(clockInAt, 1), breakDurationMs);
        }
      )
      .otherwise(() => createNewTimeRecord(PM_1, breakDurationMs));
    return newBreakRecord;
  } else {
    const lastBreak = R.last(break_records);
    const firstBreak = R.first(break_records);
    if (!lastBreak || !firstBreak) throw new Error(`Cannot add break time. ${JSON.stringify(workRecord)}`);

    const breakStart = match([firstBreak.clock_in_at, lastBreak.clock_out_at])
      .with(
        P.when(([, lastBreakClockOutAt]) =>
          isBefore(addMilliseconds(lastBreakClockOutAt, breakDurationMs), clock_out_at)
        ),
        ([, lastBreakClockOutAt]) => lastBreakClockOutAt
      )
      .with(
        P.when(([firstBreakClockInAt]) => isAfter(subMilliseconds(firstBreakClockInAt, breakDurationMs), clock_in_at)),
        ([firstBreakClockInAt]) => subMilliseconds(firstBreakClockInAt, breakDurationMs)
      )
      .otherwise((firstLastBreak) => {
        throw new Error(
          `Cannot add break time.\nargs: ${JSON.stringify(firstLastBreak)}\n${JSON.stringify(workRecord)}`
        );
      });

    const newBreakRecord = createNewTimeRecord(breakStart, breakDurationMs);
    return newBreakRecord;
  }
}

import { createAdditionalBreakTime, calculateBreakTimeMsToAdd, BreakRecordWithClockInAndOut } from "./breakRecord";

describe("calculateBreakTimeMsToAdd", () => {
  const testCases: [BreakRecordWithClockInAndOut, number, string][] = [
    // 拘束時間 ≤ 360
    [
      {
        clock_in_at: "2023-04-14T09:00:00+09:00",
        clock_out_at: "2023-04-14T14:00:00+09:00",
        break_records: [],
      },
      0,
      "拘束時間が300分、打刻済み休憩時間が0分の場合、要追加休憩時間は0分",
    ],
    [
      {
        clock_in_at: "2023-04-14T09:00:00+09:00",
        clock_out_at: "2023-04-14T15:00:00+09:00",
        break_records: [{ clock_in_at: "2023-04-14T12:00:00+09:00", clock_out_at: "2023-04-14T12:30:00+09:00" }],
      },
      0,
      "拘束時間が360分、打刻済み休憩時間が30分の場合、要追加休憩時間は0分",
    ],
    // 360 < 拘束時間 ≤ 405

    [
      {
        clock_in_at: "2023-04-14T09:00:00+09:00",
        clock_out_at: "2023-04-14T17:05:00+09:00",
        break_records: [{ clock_in_at: "2023-04-14T12:00:00+09:00", clock_out_at: "2023-04-14T12:15:00+09:00" }],
      },
      30 * 60 * 1000,
      "拘束時間が365分、打刻済み休憩時間が15分の場合、要追加休憩時間は0分",
    ],
    [
      {
        clock_in_at: "2023-04-14T09:00:00+09:00",
        clock_out_at: "2023-04-14T15:23:00+09:00",
        break_records: [],
      },
      23 * 60 * 1000,
      "拘束時間が383分、打刻済み休憩時間が0分の場合、要追加休憩時間は23分",
    ],
    // 405 < 拘束時間 ≤ 525
    [
      {
        clock_in_at: "2023-04-14T09:00:00+09:00",
        clock_out_at: "2023-04-14T16:00:00+09:00",
        break_records: [{ clock_in_at: "2023-04-14T12:00:00+09:00", clock_out_at: "2023-04-14T12:15:00+09:00" }],
      },
      30 * 60 * 1000,
      "拘束時間が420分、打刻済み休憩時間が15分の場合、要追加休憩時間は30分",
    ],
    [
      {
        clock_in_at: "2023-04-14T09:00:00+09:00",
        clock_out_at: "2023-04-14T16:23:00+09:00",
        break_records: [{ clock_in_at: "2023-04-14T12:00:00+09:00", clock_out_at: "2023-04-14T12:18:00+09:00" }],
      },
      27 * 60 * 1000,
      "拘束時間が443分、打刻済み休憩時間が18分の場合、要追加休憩時間は25分",
    ],
    [
      {
        clock_in_at: "2023-04-14T09:00:00+09:00",
        clock_out_at: "2023-04-14T16:30:00+09:00",
        break_records: [{ clock_in_at: "2023-04-14T12:00:00+09:00", clock_out_at: "2023-04-14T13:00:00+09:00" }],
      },
      0,
      "拘束時間が450分、打刻済み休憩時間が60分の場合、要追加休憩時間は0分",
    ],
    // 525 < 拘束時間 ≤ 540
    [
      {
        clock_in_at: "2023-04-14T09:00:00+09:00",
        clock_out_at: "2023-04-14T18:00:00+09:00",
        break_records: [{ clock_in_at: "2023-04-14T12:00:00+09:00", clock_out_at: "2023-04-14T12:30:00+09:00" }],
      },
      30 * 60 * 1000,
      "拘束時間が540分、打刻済み休憩時間が30分の場合、要追加休憩時間は30分",
    ],
    // 540 < 拘束時間
    [
      {
        clock_in_at: "2023-04-14T09:00:00+09:00",
        clock_out_at: "2023-04-14T18:30:00+09:00",
        break_records: [{ clock_in_at: "2023-04-14T12:00:00+09:00", clock_out_at: "2023-04-14T12:30:00+09:00" }],
      },
      30 * 60 * 1000,
      "拘束時間が570分、打刻済み休憩時間が30分の場合、要追加休憩時間は30分",
    ],
    [
      {
        clock_in_at: "2023-04-14T09:00:00+09:00",
        clock_out_at: "2023-04-14T19:00:00+09:00",
        break_records: [{ clock_in_at: "2023-04-14T12:00:00+09:00", clock_out_at: "2023-04-14T12:45:00+09:00" }],
      },
      15 * 60 * 1000,
      "拘束時間が600分、打刻済み休憩時間が45分の場合、要追加休憩時間は15分",
    ],
  ];

  testCases.forEach(([input, expectedResult, description]) => {
    it(description, () => {
      expect(calculateBreakTimeMsToAdd(input)).toBe(expectedResult);
    });
  });
});

describe("createAdditionalBreakTime", () => {
  const clockInBefore13 = "2023-03-30 09:00:00";
  const clockInAfter13 = "2023-03-30 14:00:00";
  const clockOutAfter13 = "2023-03-30 18:00:00";
  const clockOutBefore13 = "2023-03-30 11:00:00";
  const breakDurationMs = 60 * 60 * 1000; // 1時間

  test("休憩時間が0, 出勤時間が13時より前, 退勤時間が13時より後の場合、13時〜休憩を追加する", () => {
    const workRecord = {
      clock_in_at: clockInBefore13,
      clock_out_at: clockOutAfter13,
      break_records: [],
    };
    const expectedBreakRecord = {
      clock_in_at: "2023-03-30 13:00:00",
      clock_out_at: "2023-03-30 14:00:00",
    };
    const result = createAdditionalBreakTime(workRecord, breakDurationMs);
    expect(result).toEqual(expectedBreakRecord);
  });

  test("休憩時間が0, 出勤時間が13時より前, 退勤時間が13時より前の場合、出勤時間から1h後に休憩を追加する", () => {
    const workRecord = {
      clock_in_at: clockInBefore13,
      clock_out_at: clockOutBefore13,
      break_records: [],
    };
    const expectedBreakRecord = {
      clock_in_at: "2023-03-30 10:00:00",
      clock_out_at: "2023-03-30 11:00:00",
    };
    const result = createAdditionalBreakTime(workRecord, breakDurationMs);
    expect(result).toEqual(expectedBreakRecord);
  });

  test("休憩時間が0, 出勤時間が13時より後, 退勤時間が13時より後の場合、出勤時間から1h後に休憩を追加する", () => {
    const workRecord = {
      clock_in_at: clockInAfter13,
      clock_out_at: clockOutAfter13,
      break_records: [],
    };
    const expectedBreakRecord = {
      clock_in_at: "2023-03-30 15:00:00",
      clock_out_at: "2023-03-30 16:00:00",
    };
    const result = createAdditionalBreakTime(workRecord, breakDurationMs);
    expect(result).toEqual(expectedBreakRecord);
  });

  test("休憩時間がすでにある, 最後の休憩時間に休憩時間を追加しても退勤時間を超えない場合、最後の休憩時間の直後に休憩を追加する", () => {
    const workRecord = {
      clock_in_at: clockInBefore13,
      clock_out_at: clockOutAfter13,
      break_records: [
        {
          clock_in_at: "2023-03-30 10:00:00",
          clock_out_at: "2023-03-30 11:00:00",
        },
      ],
    };
    const expectedBreakRecord = {
      clock_in_at: "2023-03-30 11:00:00",
      clock_out_at: "2023-03-30 12:00:00",
    };
    const result = createAdditionalBreakTime(workRecord, breakDurationMs);
    expect(result).toEqual(expectedBreakRecord);
  });

  test("休憩時間がすでにある, 最後の休憩時間に休憩時間を追加すると退勤時間を超えてしまう場合、最初の休憩開始時間の直前に休憩を追加する", () => {
    const workRecord = {
      clock_in_at: clockInBefore13,
      clock_out_at: clockOutAfter13,
      break_records: [
        {
          clock_in_at: "2023-03-30 11:00:00",
          clock_out_at: "2023-03-30 12:00:00",
        },
        {
          clock_in_at: "2023-03-30 17:00:00",
          clock_out_at: "2023-03-30 17:30:00",
        },
      ],
    };
    const expectedBreakRecord = {
      clock_in_at: "2023-03-30 10:00:00",
      clock_out_at: "2023-03-30 11:00:00",
    };
    const result = createAdditionalBreakTime(workRecord, breakDurationMs);
    expect(result).toEqual(expectedBreakRecord);
  });
});

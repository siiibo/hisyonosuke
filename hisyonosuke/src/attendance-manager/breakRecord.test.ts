import { createAdditionalBreakTime, calculateBreakTimeMsToAdd } from "./breakRecord";

describe("calculateBreakTimeToAdd", () => {
  it("労働時間が6時間30分以上8時間未満、休憩時間が45分未満の場合、休憩時間を45分になるように差分を返す", () => {
    const clock_in_at = "2020-01-01T09:00:00.000Z";
    const clock_out_at = "2020-01-01T15:30:00.000Z";
    const break_records = [{ clock_in_at: "2020-01-01T12:00:00.000Z", clock_out_at: "2020-01-01T12:30:00.000Z" }];
    expect(calculateBreakTimeMsToAdd({ clock_in_at, clock_out_at, break_records })).toBe(900000);
  });

  it("労働時間が8時間以上、休憩時間が1時間未満の場合、休憩時間を1時間になるように差分を返す", () => {
    const clock_in_at = "2020-01-01T09:00:00.000Z";
    const clock_out_at = "2020-01-01T17:00:00.000Z";
    const break_records = [{ clock_in_at: "2020-01-01T12:00:00.000Z", clock_out_at: "2020-01-01T12:30:00.000Z" }];
    expect(calculateBreakTimeMsToAdd({ clock_in_at, clock_out_at, break_records })).toBe(1800000);
  });

  it("労働時間が6時間30分以上8時間未満、休憩時間が45分以上の場合、何もしない", () => {
    const clock_in_at = "2020-01-01T09:00:00.000Z";
    const clock_out_at = "2020-01-01T15:30:00.000Z";
    const break_records = [{ clock_in_at: "2020-01-01T12:00:00.000Z", clock_out_at: "2020-01-01T13:00:00.000Z" }];
    expect(calculateBreakTimeMsToAdd({ clock_in_at, clock_out_at, break_records })).toBe(0);
  });

  it("労働時間が8時間以上、休憩時間が1時間以上の場合、何もしない", () => {
    const clock_in_at = "2020-01-01T09:00:00.000Z";
    const clock_out_at = "2020-01-01T17:00:00.000Z";
    const break_records = [{ clock_in_at: "2020-01-01T12:00:00.000Z", clock_out_at: "2020-01-01T13:00:00.000Z" }];
    expect(calculateBreakTimeMsToAdd({ clock_in_at, clock_out_at, break_records })).toBe(0);
  });
});

describe("休憩時間の追加テスト", () => {
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

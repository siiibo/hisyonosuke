import { getTotalTimeFromTimeRanges } from "./freee";
import { EmployeesWorkRecordTimeRangeSerializer } from "./freee.schema";

describe("getWorkTimeSum", () => {
  it("should return 0 if no time range", () => {
    const timeRanges: EmployeesWorkRecordTimeRangeSerializer[] = [];
    expect(getTotalTimeFromTimeRanges(timeRanges)).toBe(0);
  });
  it("should return the sum of work time", () => {
    const timeRanges = [{ clock_in_at: "2023-01-01T09:00:00", clock_out_at: "2023-01-01T17:00:00" }];
    expect(getTotalTimeFromTimeRanges(timeRanges)).toBe(60 * 60 * 8 * 1000);
  });
  it("should return the sum of work time", () => {
    const timeRanges = [
      { clock_in_at: "2023-01-01T09:00:00", clock_out_at: "2023-01-01T17:00:00" },
      { clock_in_at: "2023-01-01T09:00:00", clock_out_at: "2023-01-01T17:00:00" },
    ];
    expect(getTotalTimeFromTimeRanges(timeRanges)).toBe(60 * 60 * 8 * 1000 * 2);
  });
});

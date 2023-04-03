import { getDayStartAsDate } from "./message";

describe("getDayStartAsDate", () => {
  const DATE_START_HOUR = 4;
  it("0:00 ~ {DATE_START_HOUR}の時間は前日の {DATE_START_HOUR}を返す", () => {
    const testCases = [
      { date: "2023-03-05T00:00:00+09:00", expected: "2023-03-04T04:00:00+09:00" },
      { date: "2023-03-04T00:05:00+09:00", expected: "2023-03-03T04:00:00+09:00" },
      { date: "2023-03-03T03:59:00+09:00", expected: "2023-03-02T04:00:00+09:00" },
    ];
    testCases.forEach((testCase) => {
      const date = new Date(testCase.date);
      const result = getDayStartAsDate(date, DATE_START_HOUR);
      expect(result).toEqual(new Date(testCase.expected));
    });
  });
  it.each([
    ["04:00:00", "2023-03-05T04:00:00+09:00"],
    ["04:05:00", "2023-03-05T04:00:00+09:00"],
    ["05:00:00", "2023-03-05T04:00:00+09:00"],
    ["09:00:00", "2023-03-05T04:00:00+09:00"],
    ["23:59:59", "2023-03-05T04:00:00+09:00"],
  ])("%sの時間は当日の 04:00を返す", (dateString, expected) => {
    const date = new Date(`2023-03-05T${dateString}+09:00`);
    const result = getDayStartAsDate(date, DATE_START_HOUR);
    expect(result).toEqual(new Date(expected));
  });
});

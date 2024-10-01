import { getDayStartAsDate, isErrorMessage, Message } from "./message";
import { REACTION } from "./reaction";

describe("getDayStartAsDate", () => {
  const DATE_START_HOUR = 4;
  it("0:00 ~ {DATE_START_HOUR}の時間は前日の {DATE_START_HOUR}を返す", () => {
    const testCases = [
      { date: "2023-03-05T00:00:00+09:00", expected: "2023-03-04T04:00:00+09:00" },
      { date: "2023-03-04T00:05:00+09:00", expected: "2023-03-03T04:00:00+09:00" },
      { date: "2023-03-03T03:59:00+09:00", expected: "2023-03-02T04:00:00+09:00" },
      { date: "2024-10-01T00:20:00+09:00", expected: "2024-09-30T04:00:00+09:00" },
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

describe("isErrorMessage関数のテスト", () => {
  const botUserId = "bot123";

  it("リアクションが含まれていない場合はfalseを返す", () => {
    const message: Message = {
      date: new Date(),
      user: "user1",
      text: "こんにちは",
      ts: "12345",
    };
    expect(isErrorMessage(message, botUserId)).toBeFalsy();
  });

  it("エラーリアクションがボットユーザーによって付与されている場合はtrueを返す", () => {
    const message: Message = {
      date: new Date(),
      user: "user1",
      text: "こんにちは",
      ts: "12345",
      reactions: [
        {
          name: REACTION.ERROR,
          users: [botUserId],
        },
      ],
    };
    expect(isErrorMessage(message, botUserId)).toBeTruthy();
  });

  it("エラーリアクションが他のユーザーによって付与されている場合はfalseを返す", () => {
    const message: Message = {
      date: new Date(),
      user: "user1",
      text: "こんにちは",
      ts: "12345",
      reactions: [
        {
          name: REACTION.ERROR,
          users: ["user2"],
        },
      ],
    };
    expect(isErrorMessage(message, botUserId)).toBeFalsy();
  });

  it("エラーリアクション以外のリアクションが付与されている場合はfalseを返す", () => {
    const message: Message = {
      date: new Date(),
      user: "user1",
      text: "こんにちは",
      ts: "12345",
      reactions: [
        {
          name: REACTION.DONE_FOR_TIME_RECORD,
          users: [botUserId],
        },
      ],
    };
    expect(isErrorMessage(message, botUserId)).toBeFalsy();
  });

  it("リアクションがundefinedの場合はfalseを返す", () => {
    const message: Message = {
      date: new Date(),
      user: "user1",
      text: "こんにちは",
      ts: "12345",
    };
    expect(isErrorMessage(message, botUserId)).toBeFalsy();
  });
});

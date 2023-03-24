import { getUserWorkStatusByCommands, WORK_STATUS } from "./userWorkStatus";
import { CommandType } from "./command";
import assert from "assert";

describe("getUserWorkStatusByCommands", function () {
  it('should return WORK_STATUS.WORKING_AT_OFFICE when given ["CLOCK_IN"]', () => {
    const commands: CommandType[] = ["CLOCK_IN"];
    assert.equal(getUserWorkStatusByCommands(commands), WORK_STATUS.WORKING_AT_OFFICE);
  });

  it('should return WORK_STATUS.WORKING_AT_OFFICE when given ["CLOCK_IN_OR_SWITCH_TO_OFFICE"]', () => {
    const commands: CommandType[] = ["CLOCK_IN_OR_SWITCH_TO_OFFICE"];
    assert.equal(getUserWorkStatusByCommands(commands), WORK_STATUS.WORKING_AT_OFFICE);
  });

  it('should return WORK_STATUS.WORKING_REMOTELY when given ["CLOCK_IN_AND_ALL_DAY_REMOTE_OR_SWITCH_TO_ALL_DAY_REMOTE"]', () => {
    const commands: CommandType[] = ["CLOCK_IN_AND_ALL_DAY_REMOTE_OR_SWITCH_TO_ALL_DAY_REMOTE"];
    assert.equal(getUserWorkStatusByCommands(commands), WORK_STATUS.WORKING_REMOTELY);
  });

  it('should return WORK_STATUS.WORKING_REMOTELY when given ["SWITCH_TO_REMOTE"]', () => {
    const commands: CommandType[] = ["SWITCH_TO_REMOTE"];
    assert.equal(getUserWorkStatusByCommands(commands), WORK_STATUS.WORKING_REMOTELY);
  });

  it('should return WORK_STATUS.BREAK when given ["BREAK_BEGIN"]', () => {
    const commands: CommandType[] = ["BREAK_BEGIN"];
    assert.equal(getUserWorkStatusByCommands(commands), WORK_STATUS.BREAK);
  });

  describe("BREAK_ENDが与えられた状況で", () => {
    it("出勤系のコマンドが存在する場合、そのコマンドに応じた出勤状態を返す", () => {
      const commands: CommandType[] = ["CLOCK_IN", "BREAK_BEGIN", "BREAK_END"];
      assert.equal(getUserWorkStatusByCommands(commands), WORK_STATUS.WORKING_AT_OFFICE);
    });
    it("出勤系のコマンドが存在する場合、BREAK_BEGINがなくてもそのコマンドに応じた出勤状態を返す", () => {
      const commands: CommandType[] = ["CLOCK_IN", "BREAK_END"];
      assert.equal(getUserWorkStatusByCommands(commands), WORK_STATUS.WORKING_AT_OFFICE);
    });
    it("出勤系のコマンドが存在しない場合、エラーを投げる", () => {
      const commands: CommandType[] = ["BREAK_BEGIN", "BREAK_END"];
      assert.throws(() => getUserWorkStatusByCommands(commands), /Unexpected command/);
    });
  });

  it('should return WORK_STATUS.CLOCKED_OUT when given ["CLOCK_OUT"]', () => {
    const commands: CommandType[] = ["CLOCK_OUT"];
    assert.equal(getUserWorkStatusByCommands(commands), WORK_STATUS.CLOCKED_OUT);
  });

  it("should throw an error when given an unexpected command", () => {
    const commands = ["UNEXPECTED_COMMAND"] as any;
    assert.throws(() => getUserWorkStatusByCommands(commands), /Unexpected command/);
  });
});

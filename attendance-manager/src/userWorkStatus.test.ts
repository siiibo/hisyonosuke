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

  it('should return WORK_STATUS.CLOCKED_OUT when given ["CLOCK_OUT"]', () => {
    const commands: CommandType[] = ["CLOCK_OUT"];
    assert.equal(getUserWorkStatusByCommands(commands), WORK_STATUS.CLOCKED_OUT);
  });

  it("should throw an error when given an unexpected command", () => {
    const commands = ["UNEXPECTED_COMMAND"] as any;
    assert.throws(() => getUserWorkStatusByCommands(commands), /Unexpected command/);
  });
});

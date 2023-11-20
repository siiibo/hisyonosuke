import { z } from "zod";

export const ReactionSchema = z.object({
  name: z.string(),
  users: z.array(z.string()),
});

export const REACTION = {
  DONE_FOR_TIME_RECORD: "dakoku_ok",
  DONE_FOR_REMOTE_MEMO: "memo_remote_ok",
  DONE_FOR_LOCATION_SWITCH: "switch_location_ok",
  ERROR: "dakoku_memo_error",
};

import { View } from "@slack/bolt";

export const select = (): View => {
  const view: View = {
    type: "modal",
    external_id: "shift-changer",
    title: {
      type: "plain_text",
      text: "シフト変更",
      emoji: true,
    },
    close: {
      type: "plain_text",
      text: "Cancel",
      emoji: true,
    },
    blocks: [
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "シフトを登録する",
              emoji: true,
            },
            value: "click_me_123",
            action_id: "registration",
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "シフトを削除 ・ 修正する",
              emoji: true,
            },
            value: "click_me_123",
            action_id: "delete_or_modify",
          },
        ],
      },
    ],
  };
  return view;
};

export const register = (): View => {
  const now = new Date();
  const nowDateStr = Utilities.formatDate(now, "JST", "yyyy-MM-dd");
  const nowMinuteStr = Utilities.formatDate(now, "JST", "HH:mm");

  const view: View = {
    type: "modal",
    title: {
      type: "plain_text",
      text: "シフト登録",
      emoji: true,
    },
    submit: {
      type: "plain_text",
      text: "Submit",
      emoji: true,
    },
    close: {
      type: "plain_text",
      text: "Cancel",
      emoji: true,
    },
    blocks: [
      {
        block_id: "date",
        type: "input",
        element: {
          type: "datepicker",
          initial_date: nowDateStr,
          placeholder: {
            type: "plain_text",
            text: "Select a date",
            emoji: true,
          },
          action_id: "datepicker-action",
        },
        label: {
          type: "plain_text",
          text: "日付",
          emoji: true,
        },
      },
      {
        block_id: "start_time",
        type: "input",
        element: {
          type: "timepicker",
          initial_time: nowMinuteStr,
          placeholder: {
            type: "plain_text",
            text: "Select time",
            emoji: true,
          },
          action_id: "timepicker-action",
        },
        label: {
          type: "plain_text",
          text: "開始",
          emoji: true,
        },
      },
      {
        block_id: "end_time",
        type: "input",
        element: {
          type: "timepicker",
          initial_time: nowMinuteStr,
          placeholder: {
            type: "plain_text",
            text: "Select time",
            emoji: true,
          },
          action_id: "timepicker-action",
        },
        label: {
          type: "plain_text",
          text: "終了",
          emoji: true,
        },
      },
      {
        block_id: "working_style",
        type: "input",
        element: {
          type: "static_select",
          placeholder: {
            type: "plain_text",
            text: "Select an item",
            emoji: true,
          },
          options: [
            {
              text: {
                type: "plain_text",
                text: "出社",
                emoji: true,
              },
              value: "syussya",
            },
            {
              text: {
                type: "plain_text",
                text: "リモート",
                emoji: true,
              },
              value: "remote",
            },
          ],
          action_id: "static_select-action",
        },
        label: {
          type: "plain_text",
          text: "勤務形態",
          emoji: true,
        },
      },
    ],
  };
  return view;
};

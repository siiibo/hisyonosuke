// @ts-nocheck //FIXME: strict modeの影響を避けている。次本ファイルを修正する際にこのコメントを解消する
import { View, ViewSubmitAction } from "@slack/bolt";

export const homeModal = (): View => {
  const view: View = {
    callback_id: "register_anniversary",
    type: "modal",
    title: {
      type: "plain_text",
      text: "誕生日・記念日登録",
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
              text: "登録",
              emoji: true,
            },
            value: "register",
            action_id: "click_register",
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "削除",
              emoji: true,
            },
            value: "delete",
            action_id: "click_delete",
          },
        ],
      },
    ],
  };

  return view;
};

export const registerModal = (): View => {
  const view: View = {
    callback_id: "register_anniversary",
    type: "modal",
    title: {
      type: "plain_text",
      text: "登録",
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
        type: "section",
        text: {
          type: "plain_text",
          text: "誕生日や記念日を登録します。\n名称には人物名や出来事、メッセージには任意の文章を設定できます。メッセージ中で特定の言葉を用いることができ、NAMEは名前、YEARSは経過年数に置き換えられます。",
          emoji: true,
        },
      },
      {
        type: "divider",
      },
      {
        type: "input",
        block_id: "type",
        element: {
          type: "static_select",
          placeholder: {
            type: "plain_text",
            text: "登録したい日付の種別を選択してください",
            emoji: true,
          },
          options: [
            {
              text: {
                type: "plain_text",
                text: "誕生日",
                emoji: true,
              },
              value: "birthday",
            },
            {
              text: {
                type: "plain_text",
                text: "記念日",
                emoji: true,
              },
              value: "anniversary",
            },
            {
              text: {
                type: "plain_text",
                text: "その他",
                emoji: true,
              },
              value: "other",
            },
          ],
          action_id: "content",
        },
        label: {
          type: "plain_text",
          text: "種別",
          emoji: true,
        },
      },
      {
        type: "input",
        block_id: "date",
        element: {
          type: "datepicker",
          initial_date: Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd"),
          placeholder: {
            type: "plain_text",
            text: "日付を選択してください",
            emoji: true,
          },
          action_id: "content",
        },
        label: {
          type: "plain_text",
          text: "日付",
          emoji: true,
        },
      },
      {
        type: "input",
        block_id: "name",
        element: {
          type: "plain_text_input",
          action_id: "content",
        },
        label: {
          type: "plain_text",
          text: "名称",
          emoji: true,
        },
      },
      {
        type: "input",
        block_id: "message",
        element: {
          initial_value: "今日はNAMEさんのお誕生日です、おめでとうございます！",
          type: "plain_text_input",
          action_id: "content",
        },
        label: {
          type: "plain_text",
          text: "メッセージ",
          emoji: true,
        },
      },
    ],
  };

  return view;
};

export const registerResultModal = (payload: ViewSubmitAction): View => {
  const view: View = {
    type: "modal",
    callback_id: "register_anniversary",
    title: {
      type: "plain_text",
      text: "登録確認",
    },
    close: {
      type: "plain_text",
      text: "Close",
      emoji: true,
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "plain_text",
          text: "以下で登録を承りました。",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "plain_text",
            text: "[種別]",
            emoji: true,
          },
          {
            type: "plain_text",
            text: payload.view.state.values.type.content.selected_option.text.text,
            emoji: true,
          },
          {
            type: "plain_text",
            text: "[名称]",
            emoji: true,
          },
          {
            type: "plain_text",
            text: payload.view.state.values.name.content.value,
            emoji: true,
          },
          {
            type: "plain_text",
            text: "[日付]",
            emoji: true,
          },
          {
            type: "plain_text",
            text: payload.view.state.values.date.content.selected_date,
            emoji: true,
          },
          {
            type: "plain_text",
            text: "[メッセージ]",
            emoji: true,
          },
          {
            type: "plain_text",
            text: payload.view.state.values.message.content.value,
            emoji: true,
          },
        ],
      },
    ],
  };
  return view;
};

export const registerFailedModal = (): View => {
  const view: View = {
    title: {
      type: "plain_text",
      text: "登録",
      emoji: true,
    },
    type: "modal",
    close: {
      type: "plain_text",
      text: "Back",
      emoji: true,
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "plain_text",
          text: "その名称の誕生日・記念日は既に登録されています。",
          emoji: true,
        },
      },
    ],
  };
  return view;
};

export const deleteModal = (): View => {
  const view: View = {
    callback_id: "register_anniversary",
    type: "modal",
    title: {
      type: "plain_text",
      text: "削除",
      emoji: true,
    },
    submit: {
      type: "plain_text",
      text: "Search",
      emoji: true,
    },
    close: {
      type: "plain_text",
      text: "Cancel",
      emoji: true,
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "plain_text",
          text: "誕生日・記念日などの種別と、名称を入力してください。",
          emoji: true,
        },
      },
      {
        type: "input",
        block_id: "type",
        element: {
          type: "static_select",
          placeholder: {
            type: "plain_text",
            text: "誕生日 or 記念日 or その他",
            emoji: true,
          },
          options: [
            {
              text: {
                type: "plain_text",
                text: "誕生日",
                emoji: true,
              },
              value: "birthday",
            },
            {
              text: {
                type: "plain_text",
                text: "記念日",
                emoji: true,
              },
              value: "anniversary",
            },
            {
              text: {
                type: "plain_text",
                text: "その他",
                emoji: true,
              },
              value: "other",
            },
          ],
          action_id: "content",
        },
        label: {
          type: "plain_text",
          text: "種別",
          emoji: true,
        },
      },
      {
        type: "input",
        block_id: "name",
        element: {
          type: "plain_text_input",
          action_id: "content",
        },
        label: {
          type: "plain_text",
          text: "名称",
          emoji: true,
        },
      },
    ],
  };
  return view;
};

export const deleteConfirmModal = (payload: ViewSubmitAction): View => {
  const view: View = {
    callback_id: "register_anniversary",
    title: {
      type: "plain_text",
      text: "削除確認",
      emoji: true,
    },
    submit: {
      type: "plain_text",
      text: "OK",
      emoji: true,
    },
    type: "modal",
    close: {
      type: "plain_text",
      text: "Cancel",
      emoji: true,
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "plain_text",
          text: "以下の誕生日・記念日を削除します。よろしいですか？",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "plain_text",
            text: "[種別]",
            emoji: true,
          },
          {
            type: "plain_text",
            text: payload.view.state.values.type.content.selected_option.text.text,
            emoji: true,
          },
          {
            type: "plain_text",
            text: "[名称]",
            emoji: true,
          },
          {
            type: "plain_text",
            text: payload.view.state.values.name.content.value,
            emoji: true,
          },
        ],
      },
    ],
  };
  return view;
};

export const deleteResultModal = (): View => {
  const view: View = {
    title: {
      type: "plain_text",
      text: "削除完了",
      emoji: true,
    },
    type: "modal",
    close: {
      type: "plain_text",
      text: "Close",
      emoji: true,
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "plain_text",
          text: "削除しました。",
          emoji: true,
        },
      },
    ],
  };
  return view;
};

export const deleteNotFoundModal = (payload: ViewSubmitAction): View => {
  const view: View = {
    title: {
      type: "plain_text",
      text: "検索結果",
      emoji: true,
    },
    type: "modal",
    close: {
      type: "plain_text",
      text: "Close",
      emoji: true,
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "plain_text",
          text: "お探しの誕生日・記念日は見つかりませんでした。",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "plain_text",
          text: "※種別・名称が完全に一致する必要があります。",
          emoji: true,
        },
      },
    ],
  };
  return view;
};

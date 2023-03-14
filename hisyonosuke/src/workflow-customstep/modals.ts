import { View } from "@slack/bolt";

export const editStepModal = (): View => {
  const view: View = {
    "type": "workflow_step",
    "blocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "スプレッドシートに追加する項目を選択します。 `insert a variable` から、下記入力欄に対応する変数を選択し、Saveしてください。"
        }
      },
      {
        "type": "input",
        "block_id": "company_name",
        "element": {
          "type": "plain_text_input",
          "action_id": "value"
        },
        "label": {
          "type": "plain_text",
          "text": "企業名",
          "emoji": true
        }
      },
      {
        "type": "input",
        "block_id": "market_division",
        "element": {
          "type": "plain_text_input",
          "action_id": "value"
        },
        "label": {
          "type": "plain_text",
          "text": "市場区分",
          "emoji": true
        }
      }
    ]
  }
  return view;
}
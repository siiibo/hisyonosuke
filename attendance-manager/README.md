# attendance-manager

勤怠管理用のSlack App

## Requirements

- `SCRIPT_ID`を Repository Secret として登録
- デプロイユーザが`yarn clasp login`し、以下の情報を`~/.clasprc.json`から取得して Repository Secret として登録
  - `ACCESS_TOKEN`
  - `CLIENT_ID`
  - `CLIENT_SECRET`
  - `ID_TOKEN`
  - `REFRESH_TOKEN`
- スクリプトを予め一度「ウェブアプリ」としてデプロイし、Deployment ID を取得して Repository Secret `DEPLOY_ID` として登録

# hisyonosuke

![hisyonosuke_icon](https://avatars.slack-edge.com/2021-01-31/1703090217988_bfd0213273b03b9d7703_72.png)

Google Apps Script で作成している Slack Bot です。

## 機能

- notificator
  - 誕生日・記念日のメッセージ通知
- birthday-registrator
  - Slack Shortcutからの誕生日・記念日の登録
- workflow-customstep
  - Spreadsheeet自動転記用のCustomStepの提供（新規IR掲載企業追加Workflow用）
- meeting-notifier
  - MTGの終了予定時刻の通知

## ToDo

- getTypeAndCallbackId()の解消

## プロジェクト構成
 
- Slackからのリクエストを受ける部分（GASで`doPost`を受ける処理）は`hisyonosuke` > [app.ts](./hisyonosuke/src/app.ts)で受けている
  - app.tsでSlackからのリクエストのTypeを識別し、biryday-registratorとworkflow-customstepに振り分け。 

## 補足

### yarn workspace

- `hisyonosuke`と`meeting-notifier`をworkspaceで分離
  - claspによるdeploy先を分けるため
- ビルドなど特定のworkspace上でコマンドを実行する方法
  - `yarn workspace <workspaceName> <commandName>`

### TypeScriptを使ってローカルでGASの開発を行う方法

- GASはデフォルトではファイルモジュールがサポートされていない
  - ファイルを分割していてもグローバルスコープとなる
- ファイルモジュールが必要ない場合は `clasp` を利用するとTS→JSへのコンパイルを自動で行ってくれる
- ファイルモジュールは`webpack` を利用することで実現している
  - 関連する設定ファイルは各WorkSpace内の以下２つのファイル
    - `webpack.config.js`
    - `tsconfig.json`
- デプロイまでの流れは以下の通り
  - `yarn workspace <workspaceName> webpack` でビルド
  - `clasp push` でコードをGAS環境にpush
  - `clasp deploy -i <deploymentID>` でデプロイの更新
- GASプロジェクトをローカルで管理する場合、以下の２つのファイルが必要
  - `.clasp.json`
    - `clasp` でpushやdeployする対象のGASプロジェクトを設定
  - `appsscript.json`
    - ランタイムやタイムゾーンなど、GAS側で必要な情報の設定
    - ブラウザ上で新規プロジェクトを作成する場合は自動で作成される
      - 初期設定ではオンラインエディタ上に表示されないようになっているが変更することで表示可能

### SlackのWebClientについて

- SlackのWebClientには [@slack/web-api](https://github.com/slackapi/node-slack-sdk)という公式ツールがある
- しかしGASはNode.jsと完全な互換性はないので上記ツールを利用することができない
- 上記ツールにはTypeScriptで開発する上で便利な情報が定義されているため、これをGASでも利用できるようにした
  - リンクは[hi-se/node-slack-sdk](https://github.com/hi-se/node-slack-sdk)
  - `https://gitpkg.now.sh/`を利用して `yarn install` している

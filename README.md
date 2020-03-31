# SORACOM Device Battery Alert
## Description
ソラコムが発売している各種デバイスのバッテリー情報を定期的取得し、通知するツール
対応しているのは、以下のデバイス
- GPSマルチユニットSORACOM Edition
- LTE-M Button for Enterprise
- LTE-M Button Plus
- LTE-M Button powered by AWS

SORACOMから情報を取得部分は、
[SORACOM の利用料金を定期的に Slack に通知する](https://blog.soracom.jp/blog/2020/01/20/notify-slack-of-soracom-usage/)
で案内のあったSORACOM　CLI Layerを使っています。

## Requirement
- SORACOM CLI Layer

## Usage
- src/hander.js をLambdaのコンソールに貼り付けます。
- 以下の環境変数を設定してください。
- VPCの設定は不要です。
- メモリは、128MBで問題ありません。
- タイムアウト値はデバイスに数によりますが、30秒以上をお勧めします。
- Cloudwatch Eventsには、実行する間隔のCron式を設定します。
    - 設定例(毎日9-19時にチェックして通知する): cron(0 0-10 * * ? *) 

### Lambda環境設定例
#### デバイスのチェックモード

Key : SW001
Value : 以下参照(対応デバイスが増えたら、桁数が増える想定)

| 桁目 | Description | 0/none | 1 |
| :--- | :--- | :--- | :--- |
| 1 | Check LTE-M Button powered by AWS | off | on |
| 2 | Check LTE-M Button for Enterprise<br>LTE-M Button Plus | off | on | 
| 3 | Check GPSマルチユニットSORACOM Edition | off | on |

設定例
- 111 -> 全デバイス
- 000 -> チェックなし
- 101 -> LTE-M Button powered by AWS と GPSマルチユニットSORACOM Editionをチェック
- 1 -> LTE-M Button powered by AWSのみチェック

#### LTE-M Button for Enterprise/LTE-M Button Plus の検索モード
Key : SW002
Value : 0(SIM Group名で検索)/1(SIMのTagで検査)

#### 環境変数の暗号化モード (Revision 1.0 未実装)
Key : SW003
Value : 0(暗号化なし)/1(Amazon KMSで暗号化)

#### 通知モード (Revision 1.0 未実装)
Key : SW004
Value : 0(毎回)/1(1日ごと)

#### GPSマルチユニットのバッテリーアラートの閾値
Key : GPS_MULTIUNIT_BATTERY_THRESHOLD
Value : 数値(ex.1)

#### LTE-M Button powered by AWS /LTE-M Button for Enterprise /LTE-M Button Plusのバッテリーアラートの閾値
Key : IOT_BUTTON_BATTERY_THRESHOLD
Value : 数値(ex.0.25) 

#### LTE-M Button for Enterprise/LTE-M Button Plus の検索用TagName
SW002で1(SIMのTagで検査)の時のみ利用
Key : BUTTON_SEARCH_TAG_NAME
Value : 検索したいタグ名

#### LTE-M Button for Enterprise/LTE-M Button Plus の検索用TagValue
Key : BUTTON_SEARCH_TAG_VALUE
Value : 検索したいタグのValue

#### SORACOMのAUTH KEY ID
Key : AUTH_KEY_ID
Value : SORACOMマネージメントコンソールで発行されるAUTH KEY ID

#### SORACOMのSECRET KEY ID
Key : AUTH_KEY
Value : SORACOMマネージメントコンソールで発行されるSECRET KEY ID

#### Slackの通知先Webhook URL
Key : SLACK_WEBHOOK_URL
Value : SORACOMマネージメントコンソールで発行されるSECRET KEY ID

## 今後の予定
- 未実装部分の実装
- もしかしたら、Mail通知とかの方がいいかもということで、Amazon SNSで通知できるようにする
- イケてない部分のリファクタリング

## Licence

[MIT](https://github.com/tcnksm/tool/blob/master/LICENCE)

## Author

[Kenichiro-Wada](https://github.com/Kenichiro-Wada)
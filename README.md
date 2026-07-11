# LLM Cost

主要なLLM APIの料金を、単純な100万トークン単価ではなく、実際のタスクで使うトークン量に基づいて比較するウェブサイトです。

## 比較できること

- タスク単価: 会話、リサーチ、ソフトウェア開発、ビジネス文書作成の1回あたり料金
- 月額: 各タスクの月間回数を指定した合計料金
- トークン内訳: 未キャッシュ入力、出力、キャッシュ書込、キャッシュ読込
- プロバイダー絞り込みと横棒グラフ比較

初期のトークン量は暫定値です。画面上で自由に変更できます。

## 収録モデル

OpenAI GPT-5.6 Sol、Anthropic Claude Fable 5、xAI Grok 4.5、Google Gemini 3.5 Flash、Meta Muse Spark 1.1、MiniMax M3、Moonshot AI Kimi K2.7 Code、Z.AI GLM-5.2、DeepSeek V4 Pro、Alibaba Qwen3.7 Max。

価格は `data/pricing.json` に100万トークンあたりのUSDで保存します。AlibabaのCNY料金は、更新時点のCNY/USDレートで換算します。公式にキャッシュ書込単価が設定されていない場合は通常入力単価、キャッシュ割引が公表されていない場合は通常入力単価を使います。

## 自動更新

`.github/workflows/update-pricing.yml` が毎週月曜日に各社の公式料金ページを確認します。構造化して抽出できた値だけを更新し、ページ構造が変わって抽出に失敗した場合は既存値を保持します。価格に変更があった場合だけ、GitHub Actions botがコミットします。

APIキーは不要です。為替換算には認証不要の Frankfurter API を利用します。

手動更新:

```bash
npm run update:pricing
```

## 開発

```bash
npm ci
npm run dev
```

検証:

```bash
npm test
npm run lint
```

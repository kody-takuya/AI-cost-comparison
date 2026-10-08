# LLM Cost

主要なLLM APIの料金を、単純な100万トークン単価ではなく、実際のタスクで使うトークン量に基づいて比較するウェブサイトです。

## 比較できること

- タスク単価: 会話、リサーチ、開発、文書作成、要約、データ分析、翻訳、構造化抽出の1回あたり料金
- 月額: 各タスクの月間回数を指定した合計料金
- トークン内訳: 未キャッシュ入力、出力、キャッシュ書込、キャッシュ読込
- プロバイダー絞り込みと横棒グラフ比較

初期のトークン量は `data/usage-norms.json` に保存しています。画面上で自由に変更できます。

## 消費トークン量の根拠

ソフトウェア開発は「コーディングエージェントへの1依頼」を単位にしています。複数の依頼を続けるセッション全体ではありません。[SyFI TraceLabの公開トレース](https://tracelab.cs.washington.edu/)は、Claude CodeとCodexの8,058セッションについて、入力1142億トークン、うちキャッシュ読込1092億、新規入力50.1億、出力3.918億を報告しています。[平均10.1依頼/セッション](https://tracelab.cs.washington.edu/exp/session/session_internal_counts/)で割ると、1依頼あたりキャッシュ読込約134万、新規入力約6.2万、出力約4,800トークンです。初期値には丸めた130万・6万・5,000を使います。調査では[入力トークンの95.6%がキャッシュ済み](https://tracelab.cs.washington.edu/exp/prefix_cache/cache_hit_ratio/)でした。

新規入力6万トークンは、未キャッシュ入力1万とキャッシュ書込5万に暫定配分しています。この内訳は公開集計から直接求められず、ハーネスやプロバイダーで変わります。キャッシュ読込も課金され、[依頼・セッションごとの使用量には大きなばらつきがあります](https://tracelab.cs.washington.edu/exp/session/session_cost_distribution/)。ほかのユースケースの初期値は引き続き暫定値です。

Claude Haiku 5.5だけは、[1回のプロンプトが10万入力トークンを超えると全単価が5倍](https://platform.claude.com/docs/en/models/haiku-5-5/overview)になります。キャッシュ読込・書込もそのプロンプトの長さに含まれます。タスク全体のトークン合計で判定せず、各ユースケースに「10万超プロンプトで請求されるトークン」の推定割合を設定し、画面で調整できるようにしています。タスク・月額では通常料金に `1 + 4 × 割合` を掛けます。割合は4種類のトークンで共通とする近似です。初期値と根拠は `data/usage-norms.json` に記録しました。開発の80%は[公開トレースの1呼び出し当たりの文脈長](https://tracelab.cs.washington.edu/exp/llm_generation/token_length_distribution/)を基にした推定で、実測されたHaiku 5.5の課金比率ではありません。トークン単価表には10万以下の通常単価を表示します。

## 収録モデル

10社の主要モデルを、高性能・標準・低価格の各層から収録しています。モデル一覧と単価は `data/pricing.json` を参照してください。

価格は `data/pricing.json` に100万トークンあたりのUSDで保存します。AlibabaのCNY料金は、更新時点のCNY/USDレートで換算します。公式にキャッシュ書込単価が設定されていない場合は通常入力単価、キャッシュ割引が公表されていない場合は通常入力単価を使います。

## 自動更新

`.github/workflows/update-pricing.yml` が毎日各社の公式料金ページを確認します。構造化して抽出できた値だけを更新し、ページ構造が変わって抽出に失敗した場合は既存値を保持します。価格に変更があった場合だけ、GitHub Actions botがコミットします。

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

GitHub Pages用の静的ビルド:

```bash
npm run build:pages
```

リポジトリの Settings → Pages → Build and deployment → Source で
`GitHub Actions` を選ぶと、`main` 更新時に `.github/workflows/deploy-pages.yml`
が `pages-dist` を公開します。

検証:

```bash
npm test
npm run lint
```

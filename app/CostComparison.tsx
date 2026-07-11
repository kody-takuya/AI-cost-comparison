"use client";

import { useMemo, useState } from "react";
import pricingData from "@/data/pricing.json";

type TokenProfile = {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
};

type UseCase = TokenProfile & {
  id: string;
  label: string;
  description: string;
  monthlyCount: number;
};

type Model = (typeof pricingData.models)[number];
type TokenKey = keyof TokenProfile;

const defaultUseCases: UseCase[] = [
  {
    id: "chat",
    label: "単純な会話",
    description: "数往復の質問・相談",
    input: 6_000,
    output: 2_000,
    cacheWrite: 2_000,
    cacheRead: 6_000,
    monthlyCount: 100,
  },
  {
    id: "research",
    label: "リサーチ",
    description: "複数資料を読み、根拠付きで整理",
    input: 80_000,
    output: 12_000,
    cacheWrite: 20_000,
    cacheRead: 60_000,
    monthlyCount: 20,
  },
  {
    id: "development",
    label: "ソフトウェア開発",
    description: "コードベースを読み、実装と検証",
    input: 120_000,
    output: 40_000,
    cacheWrite: 50_000,
    cacheRead: 180_000,
    monthlyCount: 30,
  },
  {
    id: "document",
    label: "ビジネス文書",
    description: "資料を基に文書を作成・推敲",
    input: 30_000,
    output: 8_000,
    cacheWrite: 10_000,
    cacheRead: 25_000,
    monthlyCount: 40,
  },
];

const tokenFields: { key: TokenKey; label: string }[] = [
  { key: "input", label: "未キャッシュ入力" },
  { key: "output", label: "出力" },
  { key: "cacheWrite", label: "キャッシュ書込" },
  { key: "cacheRead", label: "キャッシュ読込" },
];

const usd = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

function taskCost(model: Model, useCase: UseCase) {
  return (
    (useCase.input * model.pricing.input +
      useCase.output * model.pricing.output +
      useCase.cacheWrite * model.pricing.cacheWrite +
      useCase.cacheRead * model.pricing.cacheRead) /
    1_000_000
  );
}

function displayCost(value: number) {
  if (value === 0) return "$0.00";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return usd.format(value);
}

export function CostComparison() {
  const [mode, setMode] = useState<"task" | "monthly">("task");
  const [useCases, setUseCases] = useState(defaultUseCases);
  const [activeUseCase, setActiveUseCase] = useState(defaultUseCases[0].id);
  const [providers, setProviders] = useState(() =>
    Object.fromEntries(pricingData.models.map((model) => [model.provider, true])),
  );

  const selectedUseCase =
    useCases.find((useCase) => useCase.id === activeUseCase) ?? useCases[0];

  const results = useMemo(() => {
    return pricingData.models
      .filter((model) => providers[model.provider])
      .map((model) => ({
        model,
        cost:
          mode === "task"
            ? taskCost(model, selectedUseCase)
            : useCases.reduce(
                (total, useCase) =>
                  total + taskCost(model, useCase) * useCase.monthlyCount,
                0,
              ),
      }))
      .sort((a, b) => a.cost - b.cost);
  }, [mode, providers, selectedUseCase, useCases]);

  const maxCost = Math.max(...results.map((result) => result.cost), 0.000001);

  function updateUseCase(key: TokenKey | "monthlyCount", value: number) {
    setUseCases((current) =>
      current.map((useCase) =>
        useCase.id === activeUseCase
          ? { ...useCase, [key]: Math.max(0, Math.round(value || 0)) }
          : useCase,
      ),
    );
  }

  function toggleProvider(provider: string) {
    setProviders((current) => ({ ...current, [provider]: !current[provider] }));
  }

  const allVisible = Object.values(providers).every(Boolean);

  return (
    <main className="site-shell">
      <header className="site-header">
        <div>
          <p className="eyebrow">LLM API COST</p>
          <h1>タスクで比べる、LLM料金</h1>
        </div>
        <div className="mode-switch" aria-label="計算モード">
          <button
            type="button"
            className={mode === "task" ? "active" : ""}
            onClick={() => setMode("task")}
          >
            タスク単価
          </button>
          <button
            type="button"
            className={mode === "monthly" ? "active" : ""}
            onClick={() => setMode("monthly")}
          >
            月額
          </button>
        </div>
      </header>

      <section className="controls" aria-label="比較条件">
        <div className="use-case-tabs" role="tablist" aria-label="ユースケース">
          {useCases.map((useCase) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeUseCase === useCase.id}
              className={activeUseCase === useCase.id ? "active" : ""}
              key={useCase.id}
              onClick={() => setActiveUseCase(useCase.id)}
            >
              {useCase.label}
              {mode === "monthly" && <span>{useCase.monthlyCount}回</span>}
            </button>
          ))}
        </div>

        <div className="assumptions">
          <div className="assumption-heading">
            <div>
              <h2>{selectedUseCase.label}</h2>
              <p>{selectedUseCase.description}</p>
            </div>
            {mode === "monthly" && (
              <label className="count-field">
                <span>月間回数</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={selectedUseCase.monthlyCount}
                  onChange={(event) =>
                    updateUseCase("monthlyCount", Number(event.target.value))
                  }
                />
                <b>回</b>
              </label>
            )}
          </div>
          <div className="token-grid">
            {tokenFields.map((field) => (
              <label key={field.key}>
                <span>{field.label}</span>
                <div>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={selectedUseCase[field.key]}
                    onChange={(event) =>
                      updateUseCase(field.key, Number(event.target.value))
                    }
                  />
                  <b>tokens</b>
                </div>
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="provider-filter" aria-label="プロバイダー絞り込み">
        <div className="section-label">
          <span>プロバイダー</span>
          <button
            type="button"
            onClick={() =>
              setProviders(
                Object.fromEntries(
                  pricingData.models.map((model) => [model.provider, !allVisible]),
                ),
              )
            }
          >
            {allVisible ? "すべて解除" : "すべて表示"}
          </button>
        </div>
        <div className="filter-list">
          {pricingData.models.map((model) => (
            <label key={model.provider}>
              <input
                type="checkbox"
                checked={providers[model.provider]}
                onChange={() => toggleProvider(model.provider)}
              />
              <span>{model.provider}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="chart-section" aria-labelledby="chart-title">
        <div className="chart-heading">
          <div>
            <p>{mode === "task" ? selectedUseCase.label : "設定した月間利用量"}</p>
            <h2 id="chart-title">{mode === "task" ? "1タスクあたり" : "1か月あたり"}</h2>
          </div>
          <span>USD・API標準料金</span>
        </div>

        <div className="chart" role="list" aria-label="モデル別料金">
          {results.map(({ model, cost }) => (
            <article className="bar-row" role="listitem" key={model.id}>
              <div className="model-name">
                <strong>{model.name}</strong>
                <span>{model.provider}</span>
              </div>
              <div className="bar-track" aria-hidden="true">
                <div
                  className="bar-fill"
                  style={{ width: `${Math.max((cost / maxCost) * 100, 1.5)}%` }}
                />
              </div>
              <div className="cost-label">{displayCost(cost)}</div>
              <a href={model.source} target="_blank" rel="noreferrer" aria-label={`${model.name}の公式料金ページ`}>
                料金表
              </a>
            </article>
          ))}
          {results.length === 0 && (
            <p className="empty-state">表示するプロバイダーを選んでください。</p>
          )}
        </div>
      </section>

      <footer>
        <p>
          単価は100万トークンあたり。最終更新 {pricingData.updatedAt}。料金は税、ツール利用料、長文割増を含みません。
        </p>
        <details>
          <summary>現在の単価を見る</summary>
          <div className="rate-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>モデル</th>
                  <th>入力</th>
                  <th>出力</th>
                  <th>書込</th>
                  <th>読込</th>
                </tr>
              </thead>
              <tbody>
                {pricingData.models.map((model) => (
                  <tr key={model.id}>
                    <td>{model.name}</td>
                    <td>${model.pricing.input}</td>
                    <td>${model.pricing.output}</td>
                    <td>${model.pricing.cacheWrite}</td>
                    <td>${model.pricing.cacheRead}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </footer>
    </main>
  );
}

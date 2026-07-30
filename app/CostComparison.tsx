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
type Mode = "task" | "monthly" | "tokens";
type RateSortKey = "model" | "provider" | TokenKey;

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
  {
    id: "summarization",
    label: "長文の要約",
    description: "長い文書・議事録を短く整理",
    input: 100_000,
    output: 5_000,
    cacheWrite: 0,
    cacheRead: 0,
    monthlyCount: 30,
  },
  {
    id: "data-analysis",
    label: "データ分析",
    description: "表データを読み、傾向と示唆を出力",
    input: 60_000,
    output: 15_000,
    cacheWrite: 20_000,
    cacheRead: 40_000,
    monthlyCount: 20,
  },
  {
    id: "translation",
    label: "翻訳",
    description: "まとまった文書を別言語へ翻訳",
    input: 25_000,
    output: 28_000,
    cacheWrite: 2_000,
    cacheRead: 5_000,
    monthlyCount: 50,
  },
  {
    id: "extraction",
    label: "構造化抽出",
    description: "文書から項目を抽出しJSON化",
    input: 40_000,
    output: 3_000,
    cacheWrite: 5_000,
    cacheRead: 15_000,
    monthlyCount: 100,
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
      useCase.cacheWrite * (model.pricing.cacheWrite ?? model.pricing.input) +
      useCase.cacheRead * (model.pricing.cacheRead ?? model.pricing.input)) /
    1_000_000
  );
}

function displayCost(value: number) {
  if (value === 0) return "$0.00";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return usd.format(value);
}

function displayRate(value: number) {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })}`;
}

export function CostComparison() {
  const [mode, setMode] = useState<Mode>("task");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [rateSortKey, setRateSortKey] = useState<RateSortKey>("input");
  const [rateSortDirection, setRateSortDirection] = useState<"asc" | "desc">(
    "desc",
  );
  const [useCases, setUseCases] = useState(defaultUseCases);
  const [activeUseCase, setActiveUseCase] = useState(defaultUseCases[0].id);
  const uniqueProviders = useMemo(
    () => [...new Set(pricingData.models.map((model) => model.provider))],
    [],
  );
  const [providers, setProviders] = useState(() =>
    Object.fromEntries(uniqueProviders.map((provider) => [provider, true])),
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
            : taskCost(model, selectedUseCase) * selectedUseCase.monthlyCount,
      }))
      .sort((a, b) =>
        sortDirection === "asc" ? a.cost - b.cost : b.cost - a.cost,
      );
  }, [mode, providers, selectedUseCase, sortDirection]);

  const rateRows = useMemo(() => {
    const direction = rateSortDirection === "asc" ? 1 : -1;

    return pricingData.models
      .filter((model) => providers[model.provider])
      .sort((a, b) => {
        if (rateSortKey === "model" || rateSortKey === "provider") {
          const left = rateSortKey === "model" ? a.name : a.provider;
          const right = rateSortKey === "model" ? b.name : b.provider;
          return (
            left.localeCompare(right, "ja", { numeric: true }) * direction ||
            a.name.localeCompare(b.name, "ja", { numeric: true })
          );
        }

        const left = a.pricing[rateSortKey];
        const right = b.pricing[rateSortKey];
        if (left === null && right === null) return a.name.localeCompare(b.name);
        if (left === null) return 1;
        if (right === null) return -1;
        return (left - right) * direction || a.name.localeCompare(b.name);
      });
  }, [providers, rateSortDirection, rateSortKey]);

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

  function sortRates(key: RateSortKey) {
    if (key === rateSortKey) {
      setRateSortDirection((current) =>
        current === "asc" ? "desc" : "asc",
      );
      return;
    }
    setRateSortKey(key);
    setRateSortDirection(
      key === "model" || key === "provider" ? "asc" : "desc",
    );
  }

  function rateSortMarker(key: RateSortKey) {
    if (key !== rateSortKey) return "↕";
    return rateSortDirection === "asc" ? "↑" : "↓";
  }

  function ariaSort(key: RateSortKey) {
    if (key !== rateSortKey) return "none" as const;
    return rateSortDirection === "asc"
      ? ("ascending" as const)
      : ("descending" as const);
  }

  const allVisible = Object.values(providers).every(Boolean);

  return (
    <main className="site-shell">
      <header className="site-header">
        <h1>LLM Cost Comparison</h1>
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
          <button
            type="button"
            className={mode === "tokens" ? "active" : ""}
            onClick={() => setMode("tokens")}
          >
            トークン単価
          </button>
        </div>
      </header>

      {mode !== "tokens" && (
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
      )}

      <section className="provider-filter" aria-label="プロバイダー絞り込み">
        <div className="section-label">
          <span>プロバイダー</span>
          <button
            type="button"
            onClick={() =>
              setProviders(
                Object.fromEntries(
                  uniqueProviders.map((provider) => [provider, !allVisible]),
                ),
              )
            }
          >
            {allVisible ? "すべて解除" : "すべて表示"}
          </button>
        </div>
        <div className="filter-list">
          {uniqueProviders.map((provider) => (
            <label key={provider}>
              <input
                type="checkbox"
                checked={providers[provider]}
                onChange={() => toggleProvider(provider)}
              />
              <span>{provider}</span>
            </label>
          ))}
        </div>
      </section>

      {mode === "tokens" ? (
        <section className="chart-section" aria-labelledby="rate-table-title">
          <div className="chart-heading">
            <div>
              <p>USD・API標準料金</p>
              <h2 id="rate-table-title">トークン単価</h2>
            </div>
            <span className="rate-unit">100万 tokensあたり</span>
          </div>

          <div className="rate-comparison-wrap">
            <table className="rate-comparison-table">
              <thead>
                <tr>
                  <th aria-sort={ariaSort("model")}>
                    <button type="button" onClick={() => sortRates("model")}>
                      モデル <span>{rateSortMarker("model")}</span>
                    </button>
                  </th>
                  <th aria-sort={ariaSort("provider")}>
                    <button type="button" onClick={() => sortRates("provider")}>
                      プロバイダー <span>{rateSortMarker("provider")}</span>
                    </button>
                  </th>
                  {tokenFields.map((field) => (
                    <th key={field.key} aria-sort={ariaSort(field.key)}>
                      <button
                        type="button"
                        onClick={() => sortRates(field.key)}
                      >
                        {field.label} <span>{rateSortMarker(field.key)}</span>
                      </button>
                    </th>
                  ))}
                  <th>参照</th>
                </tr>
              </thead>
              <tbody>
                {rateRows.map((model) => (
                  <tr key={model.id}>
                    <td><strong>{model.name}</strong></td>
                    <td>{model.provider}</td>
                    <td>{displayRate(model.pricing.input)}</td>
                    <td>{displayRate(model.pricing.output)}</td>
                    <td>
                      {model.pricing.cacheWrite === null
                        ? "—"
                        : displayRate(model.pricing.cacheWrite)}
                    </td>
                    <td>
                      {model.pricing.cacheRead === null
                        ? "—"
                        : displayRate(model.pricing.cacheRead)}
                    </td>
                    <td>
                      <a
                        href={model.source}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`${model.name}の公式料金ページ`}
                      >
                        料金表
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rateRows.length === 0 && (
              <p className="empty-state">表示するプロバイダーを選んでください。</p>
            )}
          </div>
        </section>
      ) : (
        <section className="chart-section" aria-labelledby="chart-title">
          <div className="chart-heading">
            <div>
              <p>
                {mode === "task"
                  ? selectedUseCase.label
                  : `${selectedUseCase.label} × 月${selectedUseCase.monthlyCount}回`}
              </p>
              <h2 id="chart-title">{mode === "task" ? "1タスクあたり" : "1か月あたり"}</h2>
            </div>
            <div className="chart-options">
              <span>USD・API標準料金</span>
              <label>
                <span className="sr-only">並び順</span>
                <select
                  value={sortDirection}
                  onChange={(event) =>
                    setSortDirection(event.target.value as "asc" | "desc")
                  }
                >
                  <option value="asc">安い順</option>
                  <option value="desc">高い順</option>
                </select>
              </label>
            </div>
          </div>

          <div className="chart" role="list" aria-label="モデル別料金">
            {results.map(({ model, cost }) => {
              const tooltipId = `rates-${model.id}`;
              const cacheWritePrice = model.pricing.cacheWrite;
              const cachedInputPrice = model.pricing.cacheRead;

              return (
              <article
                className="bar-row"
                role="listitem"
                key={model.id}
                tabIndex={0}
                aria-describedby={tooltipId}
              >
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
                <div className="rate-tooltip" id={tooltipId} role="tooltip">
                  <strong>通常単価 / 100万 tokens</strong>
                  <dl>
                    <div><dt>入力</dt><dd>{displayRate(model.pricing.input)}</dd></div>
                    <div>
                      <dt>Cached input</dt>
                      <dd>
                        {cachedInputPrice !== null
                          ? displayRate(cachedInputPrice)
                          : "—"}
                      </dd>
                    </div>
                    <div><dt>出力</dt><dd>{displayRate(model.pricing.output)}</dd></div>
                    {cacheWritePrice !== null && (
                      <div>
                        <dt>Cache write</dt>
                        <dd>{displayRate(cacheWritePrice)}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </article>
              );
            })}
            {results.length === 0 && (
              <p className="empty-state">表示するプロバイダーを選んでください。</p>
            )}
          </div>
        </section>
      )}

      <footer>
        <p>
          Last updated: {pricingData.updatedAt} · 単価は100万トークンあたり。料金は税、ツール利用料、長文割増を含みません。
        </p>
        {mode !== "tokens" && (
          <details>
            <summary>全モデルの通常単価を見る</summary>
            <div className="rate-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>モデル</th>
                    <th>入力</th>
                    <th>出力</th>
                    <th>Cache write</th>
                    <th>Cached input</th>
                  </tr>
                </thead>
                <tbody>
                  {pricingData.models.map((model) => (
                    <tr key={model.id}>
                      <td>{model.name}</td>
                      <td>{displayRate(model.pricing.input)}</td>
                      <td>{displayRate(model.pricing.output)}</td>
                      <td>
                        {model.pricing.cacheWrite === null
                          ? "—"
                          : displayRate(model.pricing.cacheWrite)}
                      </td>
                      <td>
                        {model.pricing.cacheRead === null
                          ? "—"
                          : displayRate(model.pricing.cacheRead)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </footer>
    </main>
  );
}

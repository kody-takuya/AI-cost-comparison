"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import pricingData from "@/data/pricing.json";
import usageNorms from "@/data/usage-norms.json";

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
  haiku55LongPromptPercent: number;
  monthlyCount: number;
};

type Model = (typeof pricingData.models)[number];
type TokenKey = keyof TokenProfile;
type Mode = "task" | "monthly" | "tokens";
type RateSortKey = "model" | "provider" | TokenKey;

const defaultUseCases: UseCase[] = usageNorms.profiles;

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
  const baseCost =
    (useCase.input * model.pricing.input +
      useCase.output * model.pricing.output +
      useCase.cacheWrite * (model.pricing.cacheWrite ?? model.pricing.input) +
      useCase.cacheRead * (model.pricing.cacheRead ?? model.pricing.input)) /
    1_000_000;
  // Haiku 5.5 charges every token in a >100k-input request at 5x, not just the excess.
  return model.id === "claude-haiku-5.5"
    ? baseCost * (1 + 4 * useCase.haiku55LongPromptPercent / 100)
    : baseCost;
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
  const filterContainerRef = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<Mode>("tokens");
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
  const [selectedModels, setSelectedModels] = useState<Record<string, boolean>>(
    () => Object.fromEntries(pricingData.models.map((model) => [model.id, true])),
  );
  const selectedProviderCount = uniqueProviders.filter((provider) => providers[provider]).length;
  const availableModels = useMemo(
    () => pricingData.models.filter((model) => providers[model.provider]),
    [providers],
  );
  const selectedModelCount = availableModels.filter((model) => selectedModels[model.id]).length;
  const filteredModels = useMemo(
    () => availableModels.filter((model) => selectedModels[model.id]),
    [availableModels, selectedModels],
  );

  useEffect(() => {
    const closeFilters = () => {
      filterContainerRef.current
        ?.querySelectorAll<HTMLDetailsElement>(".filter-dropdown[open]")
        .forEach((dropdown) => dropdown.removeAttribute("open"));
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !filterContainerRef.current?.contains(target)) {
        closeFilters();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const activeDropdown = (document.activeElement as HTMLElement | null)?.closest<HTMLDetailsElement>(
        ".filter-dropdown[open]",
      );
      if (!activeDropdown) return;
      event.preventDefault();
      activeDropdown.querySelector<HTMLElement>("summary")?.focus();
      closeFilters();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const selectedUseCase =
    useCases.find((useCase) => useCase.id === activeUseCase) ?? useCases[0];

  const results = useMemo(() => {
    return filteredModels
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
  }, [filteredModels, mode, selectedUseCase, sortDirection]);

  const rateRows = useMemo(() => {
    const direction = rateSortDirection === "asc" ? 1 : -1;

    return filteredModels
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
  }, [filteredModels, rateSortDirection, rateSortKey]);

  const maxCost = Math.max(...results.map((result) => result.cost), 0.000001);

  function updateUseCase(key: TokenKey | "monthlyCount" | "haiku55LongPromptPercent", value: number) {
    setUseCases((current) =>
      current.map((useCase) =>
        useCase.id === activeUseCase
          ? {
              ...useCase,
              [key]: key === "haiku55LongPromptPercent"
                ? Math.min(100, Math.max(0, Math.round(value || 0)))
                : Math.max(0, Math.round(value || 0)),
            }
          : useCase,
      ),
    );
  }

  function toggleProvider(provider: string) {
    setProviders((current) => ({ ...current, [provider]: !current[provider] }));
  }

  function toggleModel(modelId: string) {
    setSelectedModels((current) => ({ ...current, [modelId]: !current[modelId] }));
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
            <div className="haiku-long-prompt">
              <label>
                <span>Haiku 5.5：10万超プロンプトで請求されるトークン</span>
                <span className="haiku-long-prompt-input">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={selectedUseCase.haiku55LongPromptPercent}
                    onChange={(event) =>
                      updateUseCase("haiku55LongPromptPercent", Number(event.target.value))
                    }
                  />
                  <b>%</b>
                </span>
              </label>
              <p>
                {usageNorms.evidence.haiku55.assumptions[selectedUseCase.id as keyof typeof usageNorms.evidence.haiku55.assumptions]}{" "}
                <a href="https://platform.claude.com/docs/en/models/haiku-5-5/overview" target="_blank" rel="noreferrer">料金条件</a>
              </p>
            </div>
          </div>
        </section>
      )}

      <section ref={filterContainerRef} className="provider-filter" aria-label="プロバイダー・モデル絞り込み">
        <div className="filter-dropdowns">
          <details className="filter-dropdown">
            <summary>
              <span>プロバイダー</span>
              <span className="selection-count">{selectedProviderCount}/{uniqueProviders.length}</span>
            </summary>
            <div className="filter-menu">
              <div className="filter-menu-actions">
                <button
                  type="button"
                  onClick={() => setProviders(Object.fromEntries(uniqueProviders.map((provider) => [provider, true])))}
                >すべて選択</button>
                <button
                  type="button"
                  onClick={() => setProviders(Object.fromEntries(uniqueProviders.map((provider) => [provider, false])))}
                >すべて解除</button>
              </div>
              <div className="filter-options">
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
            </div>
          </details>

          <details className="filter-dropdown">
            <summary>
              <span>モデル</span>
              <span className="selection-count">{selectedModelCount}/{availableModels.length}</span>
            </summary>
            <div className="filter-menu model-filter-menu">
              <div className="filter-menu-actions">
                <button
                  type="button"
                  onClick={() => setSelectedModels((current) => ({
                    ...current,
                    ...Object.fromEntries(availableModels.map((model) => [model.id, true])),
                  }))}
                >表示中をすべて選択</button>
                <button
                  type="button"
                  onClick={() => setSelectedModels((current) => ({
                    ...current,
                    ...Object.fromEntries(availableModels.map((model) => [model.id, false])),
                  }))}
                >表示中をすべて解除</button>
              </div>
              <div className="filter-options">
                {availableModels.map((model) => (
                  <label key={model.id}>
                    <input
                      type="checkbox"
                      checked={selectedModels[model.id]}
                      onChange={() => toggleModel(model.id)}
                    />
                    <span className="model-filter-name">
                      <span>{model.name}</span>
                      <small>{model.provider}</small>
                    </span>
                  </label>
                ))}
                {availableModels.length === 0 && (
                  <p className="filter-empty">プロバイダーを選択してください。</p>
                )}
              </div>
            </div>
          </details>
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
                  {model.id === "claude-haiku-5.5" && (
                    <p>10万超プロンプトの推定割合 {selectedUseCase.haiku55LongPromptPercent}%を5倍料金で計算</p>
                  )}
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
          Last updated: {pricingData.updatedAt} · 単価は100万トークンあたり。料金は税・ツール利用料を含みません。{mode === "tokens" ? "トークン単価表は長文割増を含みません。" : "Haiku 5.5以外の長文割増は含みません。"}
        </p>
        <p>{pricingData.notice}</p>
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
                  {filteredModels.map((model) => (
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

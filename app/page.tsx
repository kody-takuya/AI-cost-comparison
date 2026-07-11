import type { Metadata } from "next";
import { CostComparison } from "./CostComparison";

export const metadata: Metadata = {
  title: "LLM Cost — タスク別API料金比較",
  description: "主要LLMのAPI料金を、実際のユースケース別トークン量で比較します。",
};

export default function Home() {
  return <CostComparison />;
}

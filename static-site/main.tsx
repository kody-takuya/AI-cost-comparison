import React from "react";
import ReactDOM from "react-dom/client";
import { CostComparison } from "@/app/CostComparison";
import "@/app/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CostComparison />
  </React.StrictMode>,
);

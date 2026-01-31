import { tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";

const DatasetSchema = z.enum(["orders", "sales_lines", "inventory"]);

const GroupByFieldSchema = z.enum([
  "date_day",
  "date_week",
  "date_month",
  "branch_id",
  "sku",
  "category_id",
  "brand_name",
  "channel",
]);

const MetricSchema = z.enum([
  "order_count",
  "customer_count",
  "qty",
  "net_sales",
  "cost",
  "gross_profit",
]);

const OrderByFieldSchema = z.enum([
  // group fields / aliases
  "date_day",
  "date_week",
  "date_month",
  "branch_id",
  "sku",
  "category_id",
  "brand_name",
  "channel",
  // metrics
  "order_count",
  "customer_count",
  "qty",
  "net_sales",
  "cost",
  "gross_profit",
]);

function tzExpr(tsCol: string) {
  // Convert timestamptz to local time, then trunc
  return `(${tsCol} AT TIME ZONE 'Asia/Bangkok')`;
}

function dateTruncExpr(grain: "day" | "week" | "month", tsCol: string) {
  return `date_trunc('${grain}', ${tzExpr(tsCol)})`;
}

const GROUP_BY_SQL: Record<string, (dataset: string) => { expr: string; alias: string; joins?: string[] }> = {
  date_day: (dataset) => ({
    expr: dateTruncExpr("day", dataset === "orders" ? "o.order_datetime" : dataset === "sales_lines" ? "sl.order_datetime" : "inv.updated_at"),
    alias: "date_day",
  }),
  date_week: (dataset) => ({
    expr: dateTruncExpr("week", dataset === "orders" ? "o.order_datetime" : dataset === "sales_lines" ? "sl.order_datetime" : "inv.updated_at"),
    alias: "date_week",
  }),
  date_month: (dataset) => ({
    expr: dateTruncExpr("month", dataset === "orders" ? "o.order_datetime" : dataset === "sales_lines" ? "sl.order_datetime" : "inv.updated_at"),
    alias: "date_month",
  }),
  branch_id: (dataset) => ({
    expr: dataset === "orders" ? "o.branch_id" : dataset === "sales_lines" ? "sl.branch_id" : "inv.branch_id",
    alias: "branch_id",
    joins: ["LEFT JOIN analytics.branches b ON b.branch_id = " + (dataset === "orders" ? "o.branch_id" : dataset === "sales_lines" ? "sl.branch_id" : "inv.branch_id")],
  }),
  sku: (dataset) => ({
    expr: dataset === "sales_lines" ? "sl.sku" : dataset === "inventory" ? "inv.sku" : "NULL",
    alias: "sku",
    joins: ["LEFT JOIN analytics.products p ON p.sku = " + (dataset === "sales_lines" ? "sl.sku" : "inv.sku")],
  }),
  category_id: (dataset) => ({
    expr: "p.category_id",
    alias: "category_id",
    joins: [
      "LEFT JOIN analytics.products p ON p.sku = " + (dataset === "sales_lines" ? "sl.sku" : "inv.sku"),
      "LEFT JOIN analytics.product_categories c ON c.category_id = p.category_id",
    ],
  }),
  brand_name: (_dataset) => ({
    expr: "p.brand_name",
    alias: "brand_name",
    joins: ["LEFT JOIN analytics.products p ON p.sku = sl.sku"],
  }),
  channel: (_dataset) => ({
    expr: "o.channel",
    alias: "channel",
  }),
};

const METRIC_SQL: Record<string, { expr: string; alias: string; requires?: "orders" | "sales_lines" | "inventory" }> = {
  order_count: { expr: "COUNT(DISTINCT o.order_id)", alias: "order_count" },
  customer_count: { expr: "COUNT(DISTINCT o.customer_id)", alias: "customer_count" },
  qty: { expr: "COALESCE(SUM(sl.qty),0)", alias: "qty", requires: "sales_lines" },
  net_sales: { expr: "COALESCE(SUM(sl.net_sales),0)", alias: "net_sales", requires: "sales_lines" },
  cost: { expr: "COALESCE(SUM(sl.cost),0)", alias: "cost", requires: "sales_lines" },
  gross_profit: { expr: "COALESCE(SUM(sl.net_sales - sl.cost),0)", alias: "gross_profit", requires: "sales_lines" },
};

export const queryAggregateTool = tool({
  description:
    "Query + aggregate analytics data (orders, sales_lines, inventory) in PostgreSQL (read-only). Designed to keep outputs small and avoid dumping raw rows.",
  parameters: z.object({
    dataset: DatasetSchema,
    dateFrom: z.string().optional().describe("YYYY-MM-DD (local time Bangkok)"),
    dateTo: z.string().optional().describe("YYYY-MM-DD (local time Bangkok)"),
    groupBy: z.array(GroupByFieldSchema).default([]),
    metrics: z.array(MetricSchema).min(1),
    filters: z
      .object({
        branchIds: z.array(z.string()).optional(),
        skus: z.array(z.string()).optional(),
        categoryIds: z.array(z.string()).optional(),
        channels: z.array(z.string()).optional(),
      })
      .optional(),
    limit: z.number().int().min(1).max(5000).default(500),
    orderBy: z
      .object({
        field: OrderByFieldSchema.default("net_sales"),
        direction: z.enum(["asc", "desc"]).default("desc"),
      })
      .optional(),
  }),
  execute: async (input) => {
    const { dataset, groupBy, metrics, dateFrom, dateTo, filters, limit } = input;

    // Build FROM + base alias
    let fromSql = "";
    const joins: string[] = [];
    const where: string[] = [];
    const params: any[] = [];

    if (dataset === "orders") {
      fromSql = "FROM analytics.orders o";
    } else if (dataset === "sales_lines") {
      fromSql = "FROM analytics.sales_lines sl\nJOIN analytics.orders o ON o.order_id = sl.order_id";
      joins.push("LEFT JOIN analytics.products p ON p.sku = sl.sku");
      joins.push("LEFT JOIN analytics.branches b ON b.branch_id = sl.branch_id");
      joins.push("LEFT JOIN analytics.product_categories c ON c.category_id = p.category_id");
    } else {
      fromSql = "FROM analytics.inventory_current inv";
      joins.push("LEFT JOIN analytics.products p ON p.sku = inv.sku");
      joins.push("LEFT JOIN analytics.branches b ON b.branch_id = inv.branch_id");
      joins.push("LEFT JOIN analytics.product_categories c ON c.category_id = p.category_id");
    }

    // Date filters (local Bangkok). For inventory_current use updated_at.
    if (dateFrom) {
      const col = dataset === "orders" ? "o.order_datetime" : dataset === "sales_lines" ? "sl.order_datetime" : "inv.updated_at";
      where.push(`${tzExpr(col)}::date >= $${params.length + 1}`);
      params.push(dateFrom);
    }
    if (dateTo) {
      const col = dataset === "orders" ? "o.order_datetime" : dataset === "sales_lines" ? "sl.order_datetime" : "inv.updated_at";
      where.push(`${tzExpr(col)}::date <= $${params.length + 1}`);
      params.push(dateTo);
    }

    // Filters
    if (filters?.branchIds?.length) {
      const col = dataset === "orders" ? "o.branch_id" : dataset === "sales_lines" ? "sl.branch_id" : "inv.branch_id";
      where.push(`${col} = ANY($${params.length + 1})`);
      params.push(filters.branchIds);
    }
    if (filters?.skus?.length) {
      const col = dataset === "sales_lines" ? "sl.sku" : dataset === "inventory" ? "inv.sku" : "NULL";
      if (col !== "NULL") {
        where.push(`${col} = ANY($${params.length + 1})`);
        params.push(filters.skus);
      }
    }
    if (filters?.categoryIds?.length) {
      where.push(`p.category_id = ANY($${params.length + 1})`);
      params.push(filters.categoryIds);
    }
    if (filters?.channels?.length) {
      where.push(`o.channel = ANY($${params.length + 1})`);
      params.push(filters.channels);
    }

    // SELECT columns
    const selectParts: string[] = [];
    const groupParts: string[] = [];

    for (const gb of groupBy) {
      const def = GROUP_BY_SQL[gb](dataset);
      selectParts.push(`${def.expr} AS ${def.alias}`);
      groupParts.push(def.alias);
      if (def.joins) {
        for (const j of def.joins) joins.push(j);
      }
    }

    // Add friendly names when possible
    if (groupBy.includes("branch_id")) {
      selectParts.push("b.branch_name AS branch_name");
      selectParts.push("b.province AS province");
      groupParts.push("branch_name", "province");
    }
    if (groupBy.includes("sku")) {
      selectParts.push("p.product_name AS product_name");
      selectParts.push("p.brand_name AS brand_name");
      groupParts.push("product_name", "brand_name");
    }
    if (groupBy.includes("category_id")) {
      selectParts.push("c.category_name AS category_name");
      groupParts.push("category_name");
    }

    // Metrics
    for (const m of metrics) {
      const mdef = METRIC_SQL[m];
      if (mdef.requires && mdef.requires !== dataset) {
        // ignore incompatible metric
        continue;
      }
      selectParts.push(`${mdef.expr} AS ${mdef.alias}`);
    }

    if (selectParts.length === 0) {
      selectParts.push("1 AS note");
    }

    // ORDER BY
    const orderByField = input.orderBy?.field || (metrics.includes("net_sales") ? "net_sales" : metrics[0]);
    const orderDir = input.orderBy?.direction || "desc";

    const sql = `
      SELECT
        ${selectParts.join(",\n        ")}
      ${fromSql}
      ${joins.length ? joins.join("\n") : ""}
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ${groupParts.length ? "GROUP BY " + groupParts.join(", ") : ""}
      ORDER BY ${orderByField} ${orderDir}
      LIMIT ${limit}
    `;

    const rows = await db.unsafe(sql, params);
    return { ok: true, dataset, rowCount: rows.length, rows };
  },
} as any);

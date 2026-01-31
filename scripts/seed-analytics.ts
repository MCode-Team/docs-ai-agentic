import { faker } from "@faker-js/faker";
import postgres from "postgres";

/**
 * Seed demo data for analytics schema:
 * - branches, categories, products
 * - orders, sales_lines (with cost + GP)
 * - inventory_current (real-time) with some OOS and overstock
 *
 * Usage:
 *   DATABASE_URL=... bun scripts/seed-analytics.ts
 *   DATABASE_URL=... bun scripts/seed-analytics.ts --reset
 */

const db = postgres(process.env.DATABASE_URL!, { max: 10 });

function argFlag(name: string) {
  return process.argv.includes(name);
}

function toBkk(date: Date) {
  // Keep as JS Date but generate within recent range; DB stores timestamptz.
  // We'll rely on SQL AT TIME ZONE 'Asia/Bangkok' in analytics queries.
  return date;
}

async function reset() {
  console.log("Resetting analytics tables...");
  // Order matters due to FKs
  await db.unsafe(`
    TRUNCATE TABLE
      analytics.sales_lines,
      analytics.orders,
      analytics.inventory_current,
      analytics.products,
      analytics.product_categories,
      analytics.branches
    RESTART IDENTITY CASCADE;
  `);
}

async function seedMasters(opts: {
  branchCount: number;
  categoryCount: number;
  productCount: number;
}) {
  const branches = Array.from({ length: opts.branchCount }).map((_, i) => {
    const id = `B${String(i + 1).padStart(3, "0")}`;
    return {
      branch_id: id,
      branch_code: `GH-${String(100 + i)}`,
      branch_name: `Branch ${i + 1}`,
      province: faker.location.state(),
      region: faker.location.countryCode(),
    };
  });

  const categories = Array.from({ length: opts.categoryCount }).map((_, i) => {
    const id = `C${String(i + 1).padStart(3, "0")}`;
    return {
      category_id: id,
      category_name: faker.commerce.department(),
      parent_category_id: null,
    };
  });

  const brands = [
    "Marbella",
    "K-Style",
    "UniFlex",
    "UrbanWears",
    "HomePro",
    "TileX",
  ];

  const products = Array.from({ length: opts.productCount }).map((_, i) => {
    const sku = faker.string.numeric(13); // like barcode-ish
    const cat = faker.helpers.arrayElement(categories);
    const brand = faker.helpers.arrayElement(brands);
    return {
      sku,
      product_name: `${brand} ${faker.commerce.productName()}`,
      brand_name: brand,
      category_id: cat.category_id,
      uom: faker.helpers.arrayElement(["pcs", "box", "sqm"]),
    };
  });

  await db`
    INSERT INTO analytics.branches ${db(branches, [
      "branch_id",
      "branch_code",
      "branch_name",
      "province",
      "region",
    ])}
    ON CONFLICT (branch_id) DO NOTHING
  `;

  await db`
    INSERT INTO analytics.product_categories ${db(categories, [
      "category_id",
      "category_name",
      "parent_category_id",
    ])}
    ON CONFLICT (category_id) DO NOTHING
  `;

  await db`
    INSERT INTO analytics.products ${db(products, [
      "sku",
      "product_name",
      "brand_name",
      "category_id",
      "uom",
    ])}
    ON CONFLICT (sku) DO NOTHING
  `;

  return { branches, categories, products };
}

async function seedFacts(opts: {
  branches: { branch_id: string }[];
  products: { sku: string }[];
  months: number;
  ordersPerDay: number;
  maxLinesPerOrder: number;
  customerCount: number;
}) {
  console.log("Seeding orders + sales lines...");

  // customers are just ids in this schema
  const customers = Array.from({ length: opts.customerCount }).map((_, i) => {
    return `CU${String(i + 1).padStart(6, "0")}`;
  });

  const start = new Date();
  start.setDate(start.getDate() - opts.months * 30);

  let insertedOrders = 0;
  let insertedLines = 0;

  // Seed day by day to keep distribution realistic
  for (let d = 0; d < opts.months * 30; d++) {
    const day = new Date(start);
    day.setDate(start.getDate() + d);

    const todaysOrders = faker.number.int({ min: Math.max(1, Math.floor(opts.ordersPerDay * 0.6)), max: Math.ceil(opts.ordersPerDay * 1.4) });

    const orders: any[] = [];

    for (let i = 0; i < todaysOrders; i++) {
      const branch = faker.helpers.arrayElement(opts.branches);
      const customer = faker.helpers.arrayElement(customers);
      const dt = faker.date.between({
        from: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0, 0),
        to: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 21, 0, 0),
      });

      const channel = faker.helpers.arrayElement(["store", "online", "marketplace"]);
      const status = faker.helpers.weightedArrayElement([
        { weight: 10, value: "completed" },
        { weight: 2, value: "cancelled" },
        { weight: 3, value: "paid" },
      ]);

      orders.push({
        order_code: `ORD-${faker.string.alphanumeric(10).toUpperCase()}`,
        order_datetime: toBkk(dt),
        branch_id: branch.branch_id,
        customer_id: customer,
        order_status: status,
        channel,
        net_amount: 0, // update after lines
      });
    }

    // Insert orders and get ids
    const inserted = await db`
      INSERT INTO analytics.orders (order_code, order_datetime, branch_id, customer_id, order_status, channel, net_amount)
      SELECT * FROM ${(db as any)(orders, [
        "order_code",
        "order_datetime",
        "branch_id",
        "customer_id",
        "order_status",
        "channel",
        "net_amount",
      ])}
      RETURNING order_id, order_code, order_datetime, branch_id, customer_id
    `;

    insertedOrders += inserted.length;

    // Lines
    const lines: any[] = [];
    const orderNetMap = new Map<number, number>();

    for (const o of inserted as any[]) {
      const lineCount = faker.number.int({ min: 1, max: opts.maxLinesPerOrder });
      for (let j = 0; j < lineCount; j++) {
        const prod = faker.helpers.arrayElement(opts.products);
        const qty = faker.number.int({ min: 1, max: 6 });
        const price = faker.number.float({ min: 50, max: 1200, fractionDigits: 2 });
        const net = qty * price;
        const cost = net * faker.number.float({ min: 0.55, max: 0.85, fractionDigits: 2 });

        lines.push({
          order_id: o.order_id,
          order_datetime: o.order_datetime,
          branch_id: o.branch_id,
          customer_id: o.customer_id,
          sku: prod.sku,
          qty,
          net_sales: net,
          cost,
        });

        orderNetMap.set(o.order_id, (orderNetMap.get(o.order_id) || 0) + net);
      }
    }

    if (lines.length) {
      await db`
        INSERT INTO analytics.sales_lines ${(db as any)(lines, [
          "order_id",
          "order_datetime",
          "branch_id",
          "customer_id",
          "sku",
          "qty",
          "net_sales",
          "cost",
        ])}
      `;
      insertedLines += lines.length;
    }

    // Update order header net_amount
    // Batch update using VALUES
    const updates = Array.from(orderNetMap.entries()).map(([order_id, net_amount]) => ({ order_id, net_amount }));
    if (updates.length) {
      await db`
        UPDATE analytics.orders o
        SET net_amount = u.net_amount
        FROM ${(db as any)(updates, ["order_id", "net_amount"]) } AS u(order_id, net_amount)
        WHERE o.order_id = u.order_id
      `;
    }
  }

  console.log(`Seeded orders=${insertedOrders} lines=${insertedLines}`);
  return { customers };
}

async function seedInventory(opts: {
  branches: { branch_id: string }[];
  products: { sku: string }[];
  oosRate: number;
  overstockRate: number;
}) {
  console.log("Seeding inventory_current...");

  const rows: any[] = [];
  const now = new Date();

  for (const b of opts.branches) {
    // each branch carries a subset of SKUs
    const carry = faker.helpers.arrayElements(opts.products, faker.number.int({ min: Math.floor(opts.products.length * 0.2), max: Math.floor(opts.products.length * 0.5) }));
    for (const p of carry) {
      const r = faker.number.float({ min: 0, max: 1 });
      let qty = faker.number.int({ min: 1, max: 200 });
      if (r < opts.oosRate) qty = 0;
      else if (r < opts.oosRate + opts.overstockRate) qty = faker.number.int({ min: 300, max: 2000 });

      rows.push({
        branch_id: b.branch_id,
        sku: p.sku,
        on_hand_qty: qty,
        on_hand_value: null,
        updated_at: now,
      });
    }
  }

  if (rows.length) {
    await db`
      INSERT INTO analytics.inventory_current ${(db as any)(rows, [
        "branch_id",
        "sku",
        "on_hand_qty",
        "on_hand_value",
        "updated_at",
      ])}
      ON CONFLICT (branch_id, sku)
      DO UPDATE SET
        on_hand_qty = EXCLUDED.on_hand_qty,
        on_hand_value = EXCLUDED.on_hand_value,
        updated_at = EXCLUDED.updated_at
    `;
  }

  console.log(`Seeded inventory rows=${rows.length}`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL");
    process.exit(1);
  }

  const doReset = argFlag("--reset");
  if (doReset) await reset();

  const branchCount = 30;
  const categoryCount = 12;
  const productCount = 350;

  const { branches, products } = await seedMasters({
    branchCount,
    categoryCount,
    productCount,
  });

  await seedFacts({
    branches,
    products,
    months: 6,
    ordersPerDay: 120,
    maxLinesPerOrder: 6,
    customerCount: 8000,
  });

  await seedInventory({
    branches,
    products,
    oosRate: 0.08,
    overstockRate: 0.03,
  });

  console.log("✅ Seed analytics complete.");
  await db.end();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await db.end();
  } catch {}
  process.exit(1);
});

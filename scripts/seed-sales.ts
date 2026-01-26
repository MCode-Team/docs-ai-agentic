import { faker } from "@faker-js/faker";
import postgres from "postgres";

const db = postgres(process.env.DATABASE_URL!, {
    max: 10,
});

async function main() {
    console.log("Seeding sales data...");

    // Generate for past 6 months
    const months = 6;
    const ordersPerMonth = 50;

    interface Order {
        order_code: string;
        order_status: number;
        order_amount: number;
        created_at: Date;
    }

    const orders: Order[] = [];

    for (let i = 0; i < months * ordersPerMonth; i++) {
        const date = faker.date.recent({ days: months * 30 });
        const amount = parseFloat(faker.commerce.price({ min: 100, max: 10000 }));

        // Status: 1=Pending, 2=Paid, 3=Shipped, 4=Completed, 5=Cancelled
        // Weighted to have more completed orders
        const status = faker.helpers.weightedArrayElement([
            { weight: 1, value: 1 },
            { weight: 2, value: 2 },
            { weight: 3, value: 3 },
            { weight: 10, value: 4 }, // Mostly completed
            { weight: 1, value: 5 },
        ]);

        orders.push({
            order_code: `ORD-${faker.string.alphanumeric(8).toUpperCase()}`,
            order_status: status,
            order_amount: amount,
            created_at: date,
        });
    }

    // Batch insert
    await db`
    INSERT INTO sale_order.orders ${db(orders, [
        "order_code",
        "order_status",
        "order_amount",
        "created_at",
    ])}
  `;

    console.log(`Successfully inserted ${orders.length} orders.`);
    await db.end();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

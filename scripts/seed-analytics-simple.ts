import { faker } from "@faker-js/faker";
import postgres from "postgres";

const db = postgres(process.env.DATABASE_URL!, { max: 10 });

async function main() {
    console.log("Seeding analytics data (simple version)...");

    // 1. Seed branches
    const branches = [
        { branch_id: "BKK001", branch_code: "BKK001", branch_name: "สาขากรุงเทพ สยาม", province: "กรุงเทพมหานคร", region: "ภาคกลาง" },
        { branch_id: "BKK002", branch_code: "BKK002", branch_name: "สาขากรุงเทพ ลาดพร้าว", province: "กรุงเทพมหานคร", region: "ภาคกลาง" },
        { branch_id: "CNX001", branch_code: "CNX001", branch_name: "สาขาเชียงใหม่ นิมมาน", province: "เชียงใหม่", region: "ภาคเหนือ" },
        { branch_id: "KKN001", branch_code: "KKN001", branch_name: "สาขาขอนแก่น เซ็นทรัล", province: "ขอนแก่น", region: "ภาคตะวันออกเฉียงเหนือ" },
        { branch_id: "PKT001", branch_code: "PKT001", branch_name: "สาขาภูเก็ต จังซีลอน", province: "ภูเก็ต", region: "ภาคใต้" },
    ];

    for (const b of branches) {
        await db`
            INSERT INTO analytics.branches (branch_id, branch_code, branch_name, province, region)
            VALUES (${b.branch_id}, ${b.branch_code}, ${b.branch_name}, ${b.province}, ${b.region})
            ON CONFLICT (branch_id) DO NOTHING
        `;
    }
    console.log(`✅ Inserted ${branches.length} branches`);

    // 2. Seed categories
    const categories = [
        { category_id: "CAT001", category_name: "อาหารและเครื่องดื่ม" },
        { category_id: "CAT002", category_name: "เครื่องใช้ไฟฟ้า" },
        { category_id: "CAT003", category_name: "เสื้อผ้าและแฟชั่น" },
        { category_id: "CAT004", category_name: "ของใช้ในบ้าน" },
        { category_id: "CAT005", category_name: "สุขภาพและความงาม" },
    ];

    for (const c of categories) {
        await db`
            INSERT INTO analytics.product_categories (category_id, category_name, parent_category_id)
            VALUES (${c.category_id}, ${c.category_name}, ${null})
            ON CONFLICT (category_id) DO NOTHING
        `;
    }
    console.log(`✅ Inserted ${categories.length} categories`);

    // 3. Seed products
    const products = [
        { sku: "SKU001", product_name: "กาแฟสด Arabica 250g", brand_name: "Cafe Premium", category_id: "CAT001", uom: "ถุง" },
        { sku: "SKU002", product_name: "น้ำผลไม้รวม 1L", brand_name: "Fresh Juice", category_id: "CAT001", uom: "ขวด" },
        { sku: "SKU003", product_name: "เครื่องปั่นอเนกประสงค์", brand_name: "HomePro", category_id: "CAT002", uom: "เครื่อง" },
        { sku: "SKU004", product_name: "หม้อหุงข้าวดิจิตอล 1.8L", brand_name: "SmartCook", category_id: "CAT002", uom: "เครื่อง" },
        { sku: "SKU005", product_name: "เสื้อยืดคอกลม Cotton", brand_name: "Urban Style", category_id: "CAT003", uom: "ตัว" },
        { sku: "SKU006", product_name: "กางเกงยีนส์ Slim Fit", brand_name: "Denim Plus", category_id: "CAT003", uom: "ตัว" },
        { sku: "SKU007", product_name: "ผงซักฟอก 3kg", brand_name: "CleanMax", category_id: "CAT004", uom: "ถุง" },
        { sku: "SKU008", product_name: "น้ำยาล้างจาน 500ml", brand_name: "SparkleClean", category_id: "CAT004", uom: "ขวด" },
        { sku: "SKU009", product_name: "ครีมบำรุงผิวหน้า 50ml", brand_name: "SkinCare Pro", category_id: "CAT005", uom: "กระปุก" },
        { sku: "SKU010", product_name: "แชมพูสระผม 400ml", brand_name: "HairLux", category_id: "CAT005", uom: "ขวด" },
    ];

    for (const p of products) {
        await db`
            INSERT INTO analytics.products (sku, product_name, brand_name, category_id, uom)
            VALUES (${p.sku}, ${p.product_name}, ${p.brand_name}, ${p.category_id}, ${p.uom})
            ON CONFLICT (sku) DO NOTHING
        `;
    }
    console.log(`✅ Inserted ${products.length} products`);

    // 4. Seed orders and sales_lines (past 30 days)
    const channels = ["online", "walk-in", "phone"];
    const statuses = ["completed", "pending", "cancelled"];
    const branchIds = branches.map(b => b.branch_id);
    const skus = products.map(p => p.sku);

    let orderCount = 0;
    let lineCount = 0;

    // Generate 300 orders (~10 per day for 30 days)
    for (let i = 0; i < 300; i++) {
        const branchId = faker.helpers.arrayElement(branchIds);
        const customerId = `CUST${faker.string.alphanumeric(6).toUpperCase()}`;
        const channel = faker.helpers.arrayElement(channels);
        const status = faker.helpers.weightedArrayElement([
            { weight: 8, value: "completed" },
            { weight: 1, value: "pending" },
            { weight: 1, value: "cancelled" },
        ]);

        const orderDatetime = faker.date.recent({ days: 30 });
        const orderCode = `ORD-${faker.string.alphanumeric(8).toUpperCase()}`;

        // Insert order
        const [order] = await db`
            INSERT INTO analytics.orders (order_code, order_datetime, branch_id, customer_id, order_status, channel, net_amount)
            VALUES (${orderCode}, ${orderDatetime.toISOString()}, ${branchId}, ${customerId}, ${status}, ${channel}, ${0})
            RETURNING order_id
        `;

        const orderId = order.order_id;
        orderCount++;

        // Generate 1-4 sales lines per order
        const numLines = faker.number.int({ min: 1, max: 4 });
        let totalNetSales = 0;

        for (let j = 0; j < numLines; j++) {
            const sku = faker.helpers.arrayElement(skus);
            const qty = faker.number.int({ min: 1, max: 10 });
            const unitPrice = faker.number.float({ min: 50, max: 5000, fractionDigits: 2 });
            const netSales = parseFloat((qty * unitPrice).toFixed(2));
            const cost = parseFloat((netSales * faker.number.float({ min: 0.5, max: 0.8, fractionDigits: 2 })).toFixed(2));
            totalNetSales += netSales;

            await db`
                INSERT INTO analytics.sales_lines (order_id, order_datetime, branch_id, customer_id, sku, qty, net_sales, cost)
                VALUES (${orderId}, ${orderDatetime.toISOString()}, ${branchId}, ${customerId}, ${sku}, ${qty}, ${netSales}, ${cost})
            `;
            lineCount++;
        }

        // Update order net_amount
        await db`UPDATE analytics.orders SET net_amount = ${totalNetSales} WHERE order_id = ${orderId}`;

        // Progress indicator
        if (orderCount % 50 === 0) {
            console.log(`  Progress: ${orderCount} orders...`);
        }
    }

    console.log(`✅ Inserted ${orderCount} orders`);
    console.log(`✅ Inserted ${lineCount} sales lines`);

    // 5. Seed inventory
    for (const branch of branches) {
        for (const product of products) {
            const onHandQty = faker.number.int({ min: 0, max: 500 });
            const onHandValue = parseFloat((onHandQty * faker.number.float({ min: 50, max: 500, fractionDigits: 2 })).toFixed(2));

            await db`
                INSERT INTO analytics.inventory_current (branch_id, sku, on_hand_qty, on_hand_value)
                VALUES (${branch.branch_id}, ${product.sku}, ${onHandQty}, ${onHandValue})
                ON CONFLICT (branch_id, sku) DO UPDATE SET on_hand_qty = ${onHandQty}, on_hand_value = ${onHandValue}, updated_at = now()
            `;
        }
    }
    console.log(`✅ Inserted ${branches.length * products.length} inventory records`);

    console.log("\n✅ Analytics data seeding completed!");
    await db.end();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

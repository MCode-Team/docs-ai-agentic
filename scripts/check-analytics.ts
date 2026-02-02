
import { db } from "../lib/db";

async function checkAnalyticsData() {
    try {
        const count = await db`SELECT count(*) FROM analytics.orders`;
        console.log("Analytics Orders Count:", count[0].count);

        if (count[0].count > 0) {
            const sample = await db`SELECT * FROM analytics.orders LIMIT 1`;
            console.log("Sample:", sample[0]);
        }
    } catch (error) {
        console.error("Error checking analytics:", error);
    }
}

checkAnalyticsData();

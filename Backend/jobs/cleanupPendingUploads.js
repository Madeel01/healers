const cron = require("node-cron");
const cloudinary = require("../config/cloudinary");

const cleanup = async () => {
  try {
    let cursor;
    do {
      const query = cloudinary.search
        .expression("tags=pending AND created_at<1d")
        .max_results(100);
      if (cursor) query.next_cursor(cursor);

      const r = await query.execute();

      const byType = {};
      r.resources.forEach((f) => {
        (byType[f.resource_type] ||= []).push(f.public_id);
      });

      await Promise.allSettled(
        Object.entries(byType).map(([type, ids]) =>
          cloudinary.api.delete_resources(ids, { resource_type: type })
        )
      );

      cursor = r.next_cursor;
    } while (cursor);
  } catch (e) {
    console.error("Pending upload cleanup failed:", e.message);
  }
};

module.exports = () => cron.schedule("0 3 * * *", cleanup);
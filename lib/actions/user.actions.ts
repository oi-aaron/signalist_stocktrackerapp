import { connectToDatabase } from "@/database/mongoose";

/**
 * Shape expected by the newsletter job
 */
export type UserForNewsEmail = {
  id: string;
  email: string;
  name?: string;
};

/**
 * Tries to safely find users that can receive emails,
 * regardless of auth provider or collection name.
 *
 * This function:
 *  - Uses the app's active database
 *  - Auto-detects the correct collection
 *  - Fails loudly in logs (not silently)
 *  - Never throws inside background jobs
 */
export const getAllUsersForNewsEmail = async (): Promise<UserForNewsEmail[]> => {
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;

    if (!db) {
      console.error("❌ Database connection exists but db is undefined");
      return [];
    }

    // 🔍 List all collections once
    const collections = await db.listCollections().toArray();

    if (!collections.length) {
      console.error("❌ No collections found in database");
      return [];
    }

    let userCollectionName: string | null = null;

    const preferred = process.env.USER_COLLECTION_NAME;
    if (preferred && collections.some((c) => c.name === preferred)) {
      userCollectionName = preferred;
    } else {
      const commonNames = ["users", "user", "accounts", "account", "profiles"];
      const commonMatch = commonNames.find((name) =>
        collections.some((c) => c.name === name)
      );
      if (commonMatch) userCollectionName = commonMatch;
    }

    // 🧠 Detect the user collection by presence of an email field
    if (!userCollectionName) {
      for (const col of collections) {
        const hasEmail = await db.collection(col.name).findOne(
          { email: { $exists: true, $ne: null } },
          { projection: { _id: 1 } }
        );

        if (hasEmail) {
          userCollectionName = col.name;
          break;
        }
      }
    }

    if (!userCollectionName) {
      console.error(
        "❌ No collection containing user emails was found. " +
        "Check auth provider persistence."
      );
      return [];
    }

    // 📬 Fetch only users that can actually receive emails
    const users = await db
      .collection(userCollectionName)
      .find({ email: { $exists: true, $ne: null } })
      .project({ email: 1, name: 1 })
      .toArray();

    if (!users.length) {
      console.warn(
        `⚠️ User collection '${userCollectionName}' exists but has no emailable users`
      );
      return [];
    }

    console.info(
      `✅ Newsletter users loaded: ${users.length} from '${userCollectionName}'`
    );

    return users.map((u) => ({
      id: u._id.toString(),
      email: u.email,
      name: u.name || "Investor",
    }));
  } catch (error) {
    // 🚨 Never crash background jobs
    console.error("❌ getAllUsersForNewsEmail failed:", error);
    return [];
  }
};

import fs from "fs";
import { resolve } from "path";
import { Client, Databases } from "node-appwrite";
import "dotenv/config";

// --- Configuration ---
const endpoint =
  process.env.NUXT_PUBLIC_APPWRITE_ENDPOINT || "https://api.ppo.gg/v1";
const projectId = process.env.NUXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.NUXT_APPWRITE_API_KEY;

if (!projectId || !apiKey) {
  console.error(
    "❌ Missing required Appwrite environment variables (NUXT_PUBLIC_APPWRITE_PROJECT_ID, NUXT_APPWRITE_API_KEY).",
  );
  process.exit(1);
}

// --- Initialization ---
const client = new Client();
client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey);

const databases = new Databases(client);

async function syncSchema() {
  console.log("🚀 Starting Appwrite Schema Sync...");

  // Read appwrite.json
  const appwriteJsonPath = resolve(process.cwd(), "appwrite.json");
  if (!fs.existsSync(appwriteJsonPath)) {
    console.error("❌ Could not find appwrite.json at", appwriteJsonPath);
    process.exit(1);
  }

  let schema: any;
  try {
    schema = JSON.parse(fs.readFileSync(appwriteJsonPath, "utf-8"));
  } catch (err: any) {
    console.error("❌ Failed to parse appwrite.json:", err.message);
    process.exit(1);
  }

  const dbId = process.env.NUXT_PUBLIC_APPWRITE_DATABASE_ID;
  if (!dbId) {
    console.error(
      "❌ Missing NUXT_PUBLIC_APPWRITE_DATABASE_ID in environment.",
    );
    process.exit(1);
  }

  console.log(`📦 Targeted Database ID: ${dbId}`);

  const collections = schema.collections.filter(
    (c: any) => c.databaseId === dbId,
  );
  console.log(
    `🔍 Found ${collections.length} collections for target database in appwrite.json.`,
  );

  for (const coll of collections) {
    if (!coll.$id) {
      console.warn(
        `⚠️ Collection ${coll.name || "Unknown"} has no $id. Skipping.`,
      );
      continue;
    }

    console.log(`\n========================================`);
    console.log(`🔄 Processing Collection: ${coll.name} (${coll.$id})`);
    console.log(`========================================`);

    try {
      const remoteColl = await databases.getCollection(dbId, coll.$id);
      console.log(`✅ Verified remote collection exists.`);
    } catch (err: any) {
      if (err.code === 404) {
        console.warn(
          `⚠️ Remote collection ${coll.$id} not found. Creation via sync script is not fully implemented yet.`,
        );
        // If we wanted to create it, we could call databases.createCollection(...) here
        continue;
      } else {
        console.error(`❌ Error fetching collection ${coll.$id}:`, err.message);
        continue;
      }
    }

    const remoteAttributesRes = await databases.listAttributes(dbId, coll.$id);
    const remoteAttributes = remoteAttributesRes.attributes.reduce(
      (acc: any, attr: any) => {
        acc[attr.key] = attr;
        return acc;
      },
      {},
    );

    for (const localAttr of coll.attributes) {
      const remoteAttr = remoteAttributes[localAttr.key];

      if (!remoteAttr) {
        console.log(
          `[CREATE] Attribute '${localAttr.key}' (${localAttr.type}) does not exist. Attempting to create...`,
        );
        try {
          await createAttribute(databases, dbId, coll.$id, localAttr);
          console.log(`   ✔️ Success!`);
        } catch (err: any) {
          console.error(
            `   ❌ Failed to create '${localAttr.key}':`,
            err.message,
          );
        }
      } else {
        // Determine if we need to update the attribute
        let needsUpdate = false;

        // Compare size for string type
        if (localAttr.type === "string") {
          if (localAttr.size !== remoteAttr.size) {
            console.log(
              `[UPDATE] ${localAttr.key}: Size changed from ${remoteAttr.size} to ${localAttr.size}`,
            );
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          try {
            await updateAttribute(databases, dbId, coll.$id, localAttr);
            console.log(`   ✔️ Successfully updated '${localAttr.key}'.`);
          } catch (err: any) {
            console.error(
              `   ❌ Failed to update '${localAttr.key}':`,
              err.message,
            );
          }
        } else {
          console.log(
            `[SKIP] Attribute '${localAttr.key}' is already up-to-date.`,
          );
        }
      }
    }
  }

  console.log("\n🎉 Schema Sync finished!");
}

async function createAttribute(
  databases: Databases,
  dbId: string,
  collId: string,
  attr: any,
) {
  if (attr.type === "string") {
    if (attr.format === "enum" && attr.elements) {
      await databases.createEnumAttribute(
        dbId,
        collId,
        attr.key,
        attr.elements,
        attr.required,
        attr.default,
        attr.array,
      );
    } else {
      await databases.createStringAttribute(
        dbId,
        collId,
        attr.key,
        attr.size || 255,
        attr.required,
        attr.default,
        attr.array,
      );
    }
  } else if (attr.type === "integer") {
    await databases.createIntegerAttribute(
      dbId,
      collId,
      attr.key,
      attr.required,
      attr.min,
      attr.max,
      attr.default,
      attr.array,
    );
  } else if (attr.type === "boolean") {
    await databases.createBooleanAttribute(
      dbId,
      collId,
      attr.key,
      attr.required,
      attr.default,
      attr.array,
    );
  } else if (attr.type === "datetime") {
    await databases.createDatetimeAttribute(
      dbId,
      collId,
      attr.key,
      attr.required,
      attr.default,
      attr.array,
    );
  } else {
    throw new Error(`Unsupported attribute type for creation: ${attr.type}`);
  }
}

async function updateAttribute(
  databases: Databases,
  dbId: string,
  collId: string,
  attr: any,
) {
  if (attr.type === "string") {
    if (attr.format === "enum" && attr.elements) {
      await databases.updateEnumAttribute(
        dbId,
        collId,
        attr.key,
        attr.elements,
        attr.required,
        attr.default,
      );
    } else {
      // NOTE: updating strings using appwrite SDK actually changes size via updateStringAttribute
      await databases.updateStringAttribute(
        dbId,
        collId,
        attr.key,
        attr.required,
        attr.default,
        attr.size,
      );
    }
  } else {
    console.warn(
      `   ⚠️ Update for type ${attr.type} is not implemented natively in this script.`,
    );
  }
}

syncSchema().catch((err) => {
  console.error("Unhandled top-level error:", err);
  process.exit(1);
});

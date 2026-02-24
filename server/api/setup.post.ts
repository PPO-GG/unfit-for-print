import { Client, Databases, Permission, Role } from "node-appwrite";
import appwriteConfig from "../../appwrite.json";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { endpoint, projectId, apiKey } = body;

  if (!endpoint || !projectId || !apiKey) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing required configuration",
    });
  }

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  const databases = new Databases(client);
  const logs: string[] = [];

  const log = (msg: string) => {
    console.log(`[Setup] ${msg}`);
    logs.push(msg);
  };

  try {
    // 1. Setup Databases
    for (const dbConfig of appwriteConfig.databases) {
      try {
        await databases.get(dbConfig.$id);
        log(`Database ${dbConfig.name} (${dbConfig.$id}) already exists.`);
      } catch (e: any) {
        if (e.code === 404) {
          log(`Creating database ${dbConfig.name}...`);
          await databases.create(dbConfig.$id, dbConfig.name, dbConfig.enabled);
          log(`Database ${dbConfig.name} created.`);
        } else {
          throw e;
        }
      }
    }

    // 2. Setup Collections & Attributes
    for (const colConfig of appwriteConfig.collections) {
      const dbId = colConfig.databaseId;

      // Create Collection
      try {
        await databases.getCollection(dbId, colConfig.$id);
        log(`Collection ${colConfig.name} already exists.`);
      } catch (e: any) {
        if (e.code === 404) {
          log(`Creating collection ${colConfig.name}...`);
          const permissions = colConfig.$permissions.map((p) => {
            // Simple parser for permissions string from appwrite.json
            // Format: read("any"), create("users"), etc.
            const match = p.match(/(\w+)\("(.+)"\)/);
            if (match) {
              const command = match[1] as
                | "read"
                | "write"
                | "create"
                | "update"
                | "delete";
              const roleType = match[2];

              let role: string;
              switch (roleType) {
                case "users":
                  role = Role.users();
                  break;
                case "guests":
                  role = Role.guests();
                  break;
                case "any":
                default:
                  role = Role.any();
                  break;
              }

              return Permission[command](role);
            }
            return p; // Fallback if format doesn't match or is complex
          });

          await databases.createCollection(
            dbId,
            colConfig.$id,
            colConfig.name,
            permissions,
            colConfig.documentSecurity,
            colConfig.enabled,
          );
          log(`Collection ${colConfig.name} created.`);
        } else {
          throw e;
        }
      }

      // Create Attributes
      if (colConfig.attributes) {
        for (const attr of colConfig.attributes) {
          const a = attr as Record<string, any>;
          try {
            await databases.getAttribute(dbId, colConfig.$id, a.key);
            log(`Attribute ${a.key} in ${colConfig.name} already exists.`);
          } catch (e: any) {
            if (e.code === 404) {
              log(`Creating attribute ${a.key} in ${colConfig.name}...`);
              switch (a.type) {
                case "string":
                  if (a.format === "enum") {
                    await databases.createEnumAttribute(
                      dbId,
                      colConfig.$id,
                      a.key,
                      a.elements!,
                      a.required,
                      a.default,
                      a.array,
                    );
                  } else if (a.size) {
                    await databases.createStringAttribute(
                      dbId,
                      colConfig.$id,
                      a.key,
                      a.size,
                      a.required,
                      a.default,
                      a.array,
                    );
                  } else {
                    // Default size if not specified? Appwrite requires size for strings.
                    await databases.createStringAttribute(
                      dbId,
                      colConfig.$id,
                      a.key,
                      255,
                      a.required,
                      a.default,
                      a.array,
                    );
                  }
                  break;
                case "integer":
                  await databases.createIntegerAttribute(
                    dbId,
                    colConfig.$id,
                    a.key,
                    a.required,
                    a.min,
                    a.max,
                    a.default,
                    a.array,
                  );
                  break;
                case "boolean":
                  await databases.createBooleanAttribute(
                    dbId,
                    colConfig.$id,
                    a.key,
                    a.required,
                    a.default,
                    a.array,
                  );
                  break;
                case "datetime":
                  await databases.createDatetimeAttribute(
                    dbId,
                    colConfig.$id,
                    a.key,
                    a.required,
                    a.default,
                    a.array,
                  );
                  break;
                // Add other types as needed (float, email, url, ip, etc.)
                default:
                  log(`Skipping unknown attribute type ${a.type} for ${a.key}`);
              }
              // Wait a bit for attribute to be created? Appwrite is async.
              // In a real script we might need to poll for status, but for now we fire and forget or wait for promise.
            } else {
              throw e;
            }
          }
        }
      }

      // Create Indexes
      if (colConfig.indexes) {
        for (const idx of colConfig.indexes) {
          try {
            await databases.getIndex(dbId, colConfig.$id, idx.key);
            log(`Index ${idx.key} in ${colConfig.name} already exists.`);
          } catch (e: any) {
            if (e.code === 404) {
              log(`Creating index ${idx.key} in ${colConfig.name}...`);
              await databases.createIndex({
                databaseId: dbId,
                collectionId: colConfig.$id,
                key: idx.key,
                type: (idx as any).type,
                attributes: idx.attributes,
                orders: (idx as any).orders,
              });
            }
          }
        }
      }
    }

    return {
      success: true,
      message: "Database setup completed successfully",
      logs,
    };
  } catch (error: any) {
    console.error("Setup failed:", error);
    return {
      success: false,
      message: `Setup failed: ${error.message}`,
      logs,
    };
  }
});

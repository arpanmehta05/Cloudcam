import { logger } from "../core/logger";
import type { Db, IndexDescriptionInfo } from "mongodb";

const COLLECTION_NAME = "aidailymetrics";
const LEGACY_INDEX_NAME = "userId_1_date_1_provider_1";
const SCOPED_INDEX_NAME =
  "userId_1_tenantId_1_workspaceId_1_environment_1_date_1_provider_1";

const legacyIndexKey = {
  userId: 1,
  date: 1,
  provider: 1,
};

const scopedIndexKey = {
  userId: 1,
  tenantId: 1,
  workspaceId: 1,
  environment: 1,
  date: 1,
  provider: 1,
};

function hasExactKey(
  index: IndexDescriptionInfo,
  expected: Record<string, number>,
): boolean {
  const actualEntries = Object.entries(index.key);
  const expectedEntries = Object.entries(expected);

  return (
    actualEntries.length === expectedEntries.length &&
    actualEntries.every(([key, value], position) => {
      const expectedEntry = expectedEntries[position];
      return expectedEntry?.[0] === key && expectedEntry[1] === value;
    })
  );
}

export async function migrateAiDailyMetricIndexes(db: Db): Promise<void> {
  const collections = await db
    .listCollections({ name: COLLECTION_NAME })
    .toArray();
  if (collections.length === 0) {
    return;
  }

  const collection = db.collection(COLLECTION_NAME);
  const indexes = await collection.indexes();
  const legacyIndex = indexes.find(
    (index) =>
      index.name === LEGACY_INDEX_NAME &&
      index.unique === true &&
      hasExactKey(index, legacyIndexKey),
  );

  if (legacyIndex) {
    logger.info(
      "[database] Removing legacy AI daily metric index " +
        `${LEGACY_INDEX_NAME}; metrics are now scoped by workspace and environment.`,
    );
    await collection.dropIndex(LEGACY_INDEX_NAME);
  }

  await Promise.all([
    collection.updateMany(
      { tenantId: { $exists: false } },
      { $set: { tenantId: null } },
    ),
    collection.updateMany(
      { workspaceId: { $exists: false } },
      { $set: { workspaceId: null } },
    ),
    collection.updateMany(
      {
        $or: [
          { environment: { $exists: false } },
          { environment: null },
          { environment: "" },
        ],
      },
      { $set: { environment: "prod" } },
    ),
  ]);

  const refreshedIndexes = await collection.indexes();
  const scopedIndex = refreshedIndexes.find(
    (index) => index.unique === true && hasExactKey(index, scopedIndexKey),
  );

  if (!scopedIndex) {
    await collection.createIndex(scopedIndexKey, {
      name: SCOPED_INDEX_NAME,
      unique: true,
    });
    logger.info("[database] Created scoped AI daily metric unique index.");
  }
}

import { Query } from "mongoose";

export interface PaginationResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Standard pagination wrapper for Mongoose queries.
 * Chains skip() and limit() and runs them concurrently with countDocuments().
 */
export async function paginate<T>(
  query: Query<T[], any>,
  page: number = 1,
  limit: number = 20,
): Promise<PaginationResult<T>> {
  const normalizedPage = Math.max(1, page);
  const normalizedLimit = Math.max(1, limit);
  const skip = (normalizedPage - 1) * normalizedLimit;

  // Clone the query filter to run the count concurrently
  const model = query.model;
  const filter = query.getFilter();

  const [items, total] = await Promise.all([
    query.skip(skip).limit(normalizedLimit).exec(),
    model.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / normalizedLimit);

  return {
    items,
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      totalPages,
    },
  };
}

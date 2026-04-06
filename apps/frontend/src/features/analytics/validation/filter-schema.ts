import { z } from "zod";

export const analyticsFilterSchema = z
  .object({
    code: z.string().min(1),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    flatThreshold: z.number().min(-10000).max(10000),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(500),
    sort: z.string().min(1),
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: "startDate must be before or equal to endDate",
    path: ["endDate"],
  });

interface PageResetFilterState {
  code: string;
  eventId: string;
  startDate: string;
  endDate: string;
  flatThreshold: number;
}

export function resetPageOnFilterChange(
  previous: PageResetFilterState,
  next: PageResetFilterState,
  currentPage: number,
): number {
  const same =
    previous.code === next.code &&
    previous.eventId === next.eventId &&
    previous.startDate === next.startDate &&
    previous.endDate === next.endDate &&
    previous.flatThreshold === next.flatThreshold;

  return same ? currentPage : 1;
}


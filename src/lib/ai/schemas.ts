import { z } from 'zod'

// ── Bay Recommendation Schemas ──────────────────────────────────────────────

export const BayRecommendationItemSchema = z.object({
  truck_trip_id: z.string(),
  suggested_bay_id: z.string(),
  bay_current_product_id: z.string().nullable(),
  changeover_state: z.string(),
  reason_codes: z.array(z.string()),
  confidence: z.number().min(0).max(1),
})

export const BayRecommendationsOutputSchema = z.array(BayRecommendationItemSchema)

// ── Queue Resequence Schemas ────────────────────────────────────────────────

export const AtRiskTruckSchema = z.object({
  truck_trip_id: z.string(),
  risk_flags: z.array(z.string()),
  confidence: z.number().min(0).max(1),
})

export const ResequencingItemSchema = z.object({
  truck_trip_id: z.string(),
  new_predicted_start_time: z.string(),
  updated_queue_position: z.number(),
  reason_codes: z.array(z.string()),
  confidence: z.number().min(0).max(1),
})

export const QueueResequenceOutputSchema = z.object({
  at_risk_trucks: z.array(AtRiskTruckSchema),
  resequencing: z.array(ResequencingItemSchema),
})

// ── Inferred Types ──────────────────────────────────────────────────────────

export type BayRecommendationItem = z.infer<typeof BayRecommendationItemSchema>
export type QueueResequenceOutput = z.infer<typeof QueueResequenceOutputSchema>
export type AtRiskTruck = z.infer<typeof AtRiskTruckSchema>
export type ResequencingItem = z.infer<typeof ResequencingItemSchema>

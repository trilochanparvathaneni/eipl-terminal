import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
})

export const createBookingSchema = z.object({
  terminalId: z.string().min(1),
  productId: z.string().min(1, 'Product is required'),
  quantityRequested: z.number().positive('Quantity must be positive'),
  date: z.string().min(1, 'Date is required'),
  timeSlotId: z.string().optional(),
  transporterId: z.string().optional(),
  isBulk: z.boolean().default(false),
  additionalRequests: z.string().optional(),
})

export const updateBookingSchema = z.object({
  quantityRequested: z.number().positive().optional(),
  timeSlotId: z.string().optional(),
  transporterId: z.string().optional(),
  additionalRequests: z.string().optional(),
  status: z.string().optional(),
})

export const createTruckTripSchema = z.object({
  bookingId: z.string().min(1),
  truckNumber: z.string().min(1, 'Truck number is required').regex(/^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/i, 'Invalid truck number format (e.g. MH12AB1234)'),
  driverName: z.string().min(1, 'Driver name is required'),
  driverPhone: z.string().min(10, 'Valid phone number required'),
})

export const gateCheckInSchema = z.object({
  truckTripId: z.string().min(1),
  qrToken: z.string().optional(),
  weighmentTare: z.number().optional(),
  photoTruckUrl: z.string().optional(),
  photoDriverUrl: z.string().optional(),
})

export const gateCheckOutSchema = z.object({
  truckTripId: z.string().min(1),
  weighmentGross: z.number().optional(),
  netQuantity: z.number().optional(),
  photoTruckUrl: z.string().optional(),
  photoDriverUrl: z.string().optional(),
})

export const safetyChecklistSchema = z.object({
  bookingId: z.string().min(1),
  checklistJson: z.object({
    ppe: z.boolean(),
    earthing: z.boolean(),
    leakCheck: z.boolean(),
    fireSystemReadiness: z.boolean(),
    additionalNotes: z.string().optional(),
  }),
  status: z.enum(['PENDING', 'PASSED', 'FAILED']),
})

export const stopWorkOrderSchema = z.object({
  bookingId: z.string().min(1),
  reason: z.string().min(1, 'Reason is required'),
})

export const incidentSchema = z.object({
  terminalId: z.string().min(1),
  bookingId: z.string().optional(),
  severity: z.enum(['LOW', 'MED', 'HIGH']),
  description: z.string().min(1, 'Description is required'),
})

export const bayAllocationSchema = z.object({
  bookingId: z.string().min(1),
  bayId: z.string().min(1),
})

export const rescheduleSchema = z.object({
  bookingId: z.string().min(1),
  newTimeSlotId: z.string().min(1),
  reason: z.string().min(1, 'Reason is required'),
})

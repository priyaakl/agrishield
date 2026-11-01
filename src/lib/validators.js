import { z } from 'zod';

const money = z.coerce.number().positive().max(10_000_000);
const crop = z.string().trim().min(2).max(40).transform((s) => s[0].toUpperCase() + s.slice(1).toLowerCase());

export const registerSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(8, 'must be at least 8 characters').max(72)
    .regex(/[A-Za-z]/, 'needs a letter').regex(/[0-9]/, 'needs a number'),
  phone: z.string().trim().regex(/^[6-9][0-9]{9}$/, 'must be a 10-digit Indian mobile number'),
  location_district: z.string().trim().min(2).max(60),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(72),
});

export const parcelSchema = z.object({
  parcel_name: z.string().trim().min(2).max(60),
  survey_number: z.string().trim().max(30).optional().or(z.literal('')),
  acres: z.coerce.number().positive().max(1000),
  soil_type: z.enum(['RED', 'BLACK', 'ALLUVIAL', 'LATERITE', 'SANDY', 'CLAY', 'LOAMY']),
  gps_latitude: z.coerce.number().min(-90).max(90).optional(),
  gps_longitude: z.coerce.number().min(-180).max(180).optional(),
});

export const policySchema = z.object({
  parcel_id: z.coerce.number().int().positive(),
  crop_type: crop,
  season: z.enum(['KHARIF', 'RABI', 'ZAID']),
  coverage_amount: money,
  premium_amount: z.coerce.number().min(0).max(10_000_000),
  start_date: z.string().date(),
  end_date: z.string().date(),
}).refine((p) => p.end_date > p.start_date, { message: 'end date must be after start date', path: ['end_date'] });

export const reportSchema = z.object({
  parcel_id: z.coerce.number().int().positive(),
  crop_type: crop,
  symptom_text: z.string().trim().min(15, 'describe the symptoms in at least 15 characters').max(2000),
  affected_area_pct: z.coerce.number().gt(0).max(100),
});

export const reviewSchema = z.object({
  review_status: z.enum(['REVIEWED', 'DISMISSED']),
  matched_disease_id: z.coerce.number().int().positive().optional().nullable(),
  inspector_notes: z.string().trim().max(1000).optional(),
});

export const searchSchema = z.object({
  query: z.string().trim().min(5).max(1000),
  crop: z.string().trim().max(40).optional().or(z.literal('')),
  k: z.coerce.number().int().min(1).max(10).default(5),
});

export const diseaseSchema = z.object({
  disease_name: z.string().trim().min(3).max(80),
  affected_crop: crop,
  pathogen_type: z.enum(['FUNGAL', 'BACTERIAL', 'VIRAL', 'PEST', 'NUTRIENT', 'OTHER']),
  symptom_description: z.string().trim().min(20).max(3000),
  recommended_treatment: z.string().trim().min(5).max(3000),
  source_reference: z.string().trim().max(200).optional(),
});

export const claimSchema = z.object({
  policy_id: z.coerce.number().int().positive(),
  report_id: z.coerce.number().int().positive(),
  claim_amount: money,
});

export const decisionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    amount_paid: money,
    payment_reference: z.string().trim().min(4).max(40).regex(/^[A-Z0-9-]+$/, 'use capital letters, digits and dashes'),
    payment_mode: z.enum(['DBT', 'NEFT', 'UPI', 'CHEQUE']).default('DBT'),
    note: z.string().trim().max(500).optional(),
  }),
  z.object({ action: z.literal('reject'), reason: z.string().trim().min(5).max(500) }),
]);

export const telemetrySchema = z.object({
  parcel_id: z.coerce.number().int().positive(),
  source: z.enum(['SOIL_SENSOR', 'WEATHER_STATION', 'MANUAL']),
  device_id: z.string().trim().min(3).max(40),
  soil_moisture: z.coerce.number().min(0).max(100).optional(),
  soil_ph: z.coerce.number().min(0).max(14).optional(),
  air_temp: z.coerce.number().min(-10).max(60).optional(),
  humidity: z.coerce.number().min(0).max(100).optional(),
  rainfall_mm: z.coerce.number().min(0).max(500).optional(),
  leaf_wetness_hrs: z.coerce.number().min(0).max(24).optional(),
});

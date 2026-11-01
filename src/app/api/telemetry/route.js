import { handler, ok, parse, requireRole, HttpError } from '@/lib/api';
import { query } from '@/lib/db';
import { telemetryCollection } from '@/lib/mongo';
import { telemetrySchema } from '@/lib/validators';
import { dailyAveragesPipeline, riskSignalsPipeline } from '@/lib/telemetryPipelines.mjs';

// MongoDB can't enforce a foreign key to PostgreSQL, so the API checks the
// parcel exists (and belongs to the farmer) before reading or writing telemetry.
async function checkParcel(s, parcelId) {
  const { rows } = await query(
    'SELECT parcel_id, farmer_id FROM land_parcels WHERE parcel_id = $1 AND ($2::bigint IS NULL OR farmer_id = $2)',
    [parcelId, s.role === 'FARMER' ? s.fid : null]
  );
  if (!rows.length) throw new HttpError(404, 'Parcel not found');
  return rows[0];
}

export const GET = handler(async (req) => {
  const s = await requireRole('FARMER', 'INSPECTOR', 'ADMIN');
  const url = new URL(req.url);
  const parcelId = Number(url.searchParams.get('parcel_id'));
  const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 14, 1), 90);
  if (!Number.isInteger(parcelId) || parcelId < 1) throw new HttpError(400, 'parcel_id is required');
  await checkParcel(s, parcelId);

  const col = await telemetryCollection();
  const [latest, daily, risk] = await Promise.all([
    col.find({ parcel_id: parcelId }, { projection: { _id: 0 } }).sort({ timestamp: -1 }).limit(8).toArray(),
    col.aggregate(dailyAveragesPipeline(parcelId, days)).toArray(),
    col.aggregate(riskSignalsPipeline([parcelId], days)).toArray(),
  ]);
  return ok({ latest, daily, risk: risk[0] || null });
});

export const POST = handler(async (req) => {
  const s = await requireRole('FARMER');
  const b = parse(telemetrySchema, await req.json());
  const parcel = await checkParcel(s, b.parcel_id);

  const fields = ['soil_moisture', 'soil_ph', 'air_temp', 'humidity', 'rainfall_mm', 'leaf_wetness_hrs'];
  const sensor_readings = Object.fromEntries(fields.filter((f) => b[f] !== undefined).map((f) => [f, b[f]]));
  if (!Object.keys(sensor_readings).length) throw new HttpError(400, 'Enter at least one reading');

  const col = await telemetryCollection();
  const doc = {
    parcel_id: parcel.parcel_id, farmer_id: parcel.farmer_id, device_id: b.device_id,
    source: b.source, timestamp: new Date(), sensor_readings,
  };
  const r = await col.insertOne(doc);
  return ok({ inserted_id: r.insertedId }, 201);
});

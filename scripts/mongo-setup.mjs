// Creates the MongoDB telemetry collection (validator + indexes) and loads
// 30 days of simulated readings. parcel_id/farmer_id are read from PostgreSQL
// so the cross-database references are valid.
import pg from 'pg';
import { MongoClient } from 'mongodb';
import { need } from './env.mjs';
import { telemetryValidator } from '../src/lib/telemetryPipelines.mjs';

const pgc = new pg.Client({ connectionString: need('DATABASE_URL') });
const mongo = new MongoClient(need('MONGODB_URI'));

// small deterministic random generator so every team member gets the same data
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const between = (a, b, dp = 1) => Number((a + rand() * (b - a)).toFixed(dp));

try {
  await pgc.connect();
  await mongo.connect();
  const db = mongo.db(process.env.MONGODB_DB || 'agrishield');

  // ::int so ids arrive as numbers (BIGINT comes back as a string), which the validator requires
  const { rows: parcels } = await pgc.query('SELECT parcel_id::int AS parcel_id, farmer_id::int AS farmer_id FROM land_parcels ORDER BY parcel_id');
  if (!parcels.length) throw new Error('No parcels in PostgreSQL - run npm run db:setup first');

  await db.collection('field_telemetry').drop().catch(() => {});
  await db.createCollection('field_telemetry', { validator: telemetryValidator, validationLevel: 'strict' });
  const col = db.collection('field_telemetry');
  await col.createIndex({ parcel_id: 1, timestamp: -1 }, { name: 'parcel_time' });
  await col.createIndex({ farmer_id: 1, timestamp: -1 }, { name: 'farmer_time' });
  await col.createIndex({ source: 1 }, { name: 'source' });

  const docs = [];
  const now = Date.now();
  for (const p of parcels) {
    const humidBias = p.parcel_id % 3 === 0 ? 10 : 0; // some parcels are more humid (fungal risk)
    for (let day = 30; day >= 0; day--) {
      const base = new Date(now - day * 86400000);
      for (const hour of [7, 16]) {
        const ts = new Date(base); ts.setUTCHours(hour, 0, 0, 0);
        docs.push({
          parcel_id: p.parcel_id, farmer_id: p.farmer_id,
          device_id: `SOIL-${p.parcel_id}-A`, source: 'SOIL_SENSOR', timestamp: ts,
          sensor_readings: { soil_moisture: between(14, 48), soil_ph: between(5.8, 7.8, 2), soil_temp: between(22, 34) },
        });
      }
      if (day % 2 === 0) { // weather station reports every other day, with different fields
        const ts = new Date(base); ts.setUTCHours(12, 0, 0, 0);
        docs.push({
          parcel_id: p.parcel_id, farmer_id: p.farmer_id,
          device_id: `WX-${p.parcel_id}`, source: 'WEATHER_STATION', timestamp: ts,
          sensor_readings: {
            air_temp: between(22, 35), humidity: Math.min(100, between(55, 92) + humidBias),
            rainfall_mm: rand() < 0.35 ? between(1, 40) : 0, leaf_wetness_hrs: between(0, 10),
          },
        });
      }
      if (day % 7 === 0) { // weekly drone flight: no sensor_readings at all, only scan metadata
        const ts = new Date(base); ts.setUTCHours(9, 30, 0, 0);
        docs.push({
          parcel_id: p.parcel_id, farmer_id: p.farmer_id,
          device_id: 'DRONE-01', source: 'DRONE', timestamp: ts,
          drone_scan_metadata: {
            imagery_type: 'MULTISPECTRAL', ndvi_mean: between(0.35, 0.82, 2),
            canopy_cover_pct: between(40, 95), image_ref: `scans/p${p.parcel_id}/${ts.toISOString().slice(0, 10)}.tif`,
          },
        });
      }
    }
  }
  const res = await col.insertMany(docs);
  console.log(`MongoDB ready: ${res.insertedCount} telemetry documents for ${parcels.length} parcels`);

  // prove the validator works
  try {
    await col.insertOne({ parcel_id: 1, farmer_id: 1, device_id: 'BAD', source: 'SOIL_SENSOR', timestamp: new Date(), sensor_readings: { soil_ph: 22 } });
    console.log('WARNING: validator accepted an impossible pH');
  } catch {
    console.log('Validator check: document with pH 22 was rejected (expected)');
  }
} catch (e) {
  console.error('FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await pgc.end().catch(() => {});
  await mongo.close().catch(() => {});
}

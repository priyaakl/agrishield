// MongoDB aggregation pipelines for field telemetry (shared by the API and the demo script).
// Documents have different fields depending on the device, and $avg simply skips
// missing fields - that is exactly why this data lives in MongoDB.

const since = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

// Daily averages for one parcel
export const dailyAveragesPipeline = (parcelId, days = 14) => [
  { $match: { parcel_id: parcelId, timestamp: { $gte: since(days) } } },
  {
    $group: {
      _id: { $dateTrunc: { date: '$timestamp', unit: 'day' } },
      avg_soil_moisture: { $avg: '$sensor_readings.soil_moisture' },
      avg_soil_ph: { $avg: '$sensor_readings.soil_ph' },
      avg_air_temp: { $avg: '$sensor_readings.air_temp' },
      avg_humidity: { $avg: '$sensor_readings.humidity' },
      rainfall_mm: { $sum: { $ifNull: ['$sensor_readings.rainfall_mm', 0] } },
      readings: { $sum: 1 },
    },
  },
  { $sort: { _id: 1 } },
  {
    $project: {
      _id: 0, day: '$_id', readings: 1, rainfall_mm: { $round: ['$rainfall_mm', 1] },
      avg_soil_moisture: { $round: ['$avg_soil_moisture', 1] },
      avg_soil_ph: { $round: ['$avg_soil_ph', 2] },
      avg_air_temp: { $round: ['$avg_air_temp', 1] },
      avg_humidity: { $round: ['$avg_humidity', 1] },
    },
  },
];

// Disease-risk signals per parcel: humid + long leaf wetness favours fungal disease;
// low soil moisture means water stress.
export const riskSignalsPipeline = (parcelIds, days = 14) => [
  { $match: { parcel_id: { $in: parcelIds }, timestamp: { $gte: since(days) } } },
  {
    $group: {
      _id: '$parcel_id',
      fungal_risk_readings: {
        $sum: {
          $cond: [{ $and: [
            { $gte: ['$sensor_readings.humidity', 85] },
            { $gte: ['$sensor_readings.leaf_wetness_hrs', 6] },
          ] }, 1, 0],
        },
      },
      dry_soil_readings: {
        $sum: { $cond: [{ $and: [
          { $ne: [{ $type: '$sensor_readings.soil_moisture' }, 'missing'] },
          { $lt: ['$sensor_readings.soil_moisture', 20] },
        ] }, 1, 0] },
      },
      min_ndvi: { $min: '$drone_scan_metadata.ndvi_mean' },
      last_reading: { $max: '$timestamp' },
      total_readings: { $sum: 1 },
    },
  },
  { $project: { _id: 0, parcel_id: '$_id', fungal_risk_readings: 1, dry_soil_readings: 1, min_ndvi: 1, last_reading: 1, total_readings: 1 } },
  { $sort: { fungal_risk_readings: -1 } },
];

// How many documents each device type produced (admin analytics)
export const sourceBreakdownPipeline = () => [
  { $group: { _id: '$source', documents: { $sum: 1 }, parcels: { $addToSet: '$parcel_id' } } },
  { $project: { _id: 0, source: '$_id', documents: 1, parcel_count: { $size: '$parcels' } } },
  { $sort: { documents: -1 } },
];

// JSON-schema validator for the collection (structure is checked, sensor fields stay flexible)
export const telemetryValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['parcel_id', 'farmer_id', 'device_id', 'source', 'timestamp'],
    properties: {
      parcel_id: { bsonType: ['int', 'long', 'double'], minimum: 1, description: 'logical ref to land_parcels.parcel_id' },
      farmer_id: { bsonType: ['int', 'long', 'double'], minimum: 1, description: 'logical ref to farmers.farmer_id' },
      device_id: { bsonType: 'string', minLength: 3 },
      source: { enum: ['SOIL_SENSOR', 'WEATHER_STATION', 'DRONE', 'MANUAL'] },
      timestamp: { bsonType: 'date' },
      sensor_readings: {
        bsonType: 'object',
        properties: {
          soil_moisture: { bsonType: ['double', 'int'], minimum: 0, maximum: 100 },
          soil_ph: { bsonType: ['double', 'int'], minimum: 0, maximum: 14 },
          humidity: { bsonType: ['double', 'int'], minimum: 0, maximum: 100 },
          air_temp: { bsonType: ['double', 'int'], minimum: -10, maximum: 60 },
        },
      },
      drone_scan_metadata: {
        bsonType: 'object',
        properties: {
          ndvi_mean: { bsonType: ['double', 'int'], minimum: -1, maximum: 1 },
          imagery_type: { enum: ['RGB', 'MULTISPECTRAL', 'THERMAL'] },
        },
      },
    },
  },
};

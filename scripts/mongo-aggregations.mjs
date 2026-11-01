// Prints the three telemetry aggregations used in the app (for the report/demo).
import { MongoClient } from 'mongodb';
import { need } from './env.mjs';
import { dailyAveragesPipeline, riskSignalsPipeline, sourceBreakdownPipeline } from '../src/lib/telemetryPipelines.mjs';

const mongo = new MongoClient(need('MONGODB_URI'));
try {
  await mongo.connect();
  const col = mongo.db(process.env.MONGODB_DB || 'agrishield').collection('field_telemetry');
  console.log('\n1) Daily averages, parcel 1, last 7 days');
  console.table(await col.aggregate(dailyAveragesPipeline(1, 7)).toArray());
  console.log('\n2) Disease-risk signals, all parcels, last 14 days');
  console.table(await col.aggregate(riskSignalsPipeline([1, 2, 3, 4, 5, 6, 7], 14)).toArray());
  console.log('\n3) Documents per device type');
  console.table(await col.aggregate(sourceBreakdownPipeline()).toArray());
  console.log('\nQuery plan for parcel lookup (should use the parcel_time index):');
  const plan = await col.find({ parcel_id: 1 }).sort({ timestamp: -1 }).limit(5).explain();
  console.log(JSON.stringify(plan.queryPlanner.winningPlan, null, 1).slice(0, 600));
} finally {
  await mongo.close();
}

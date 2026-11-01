import { MongoClient } from 'mongodb';

export async function telemetryCollection() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
  if (!globalThis.__agrishieldMongo) {
    globalThis.__agrishieldMongo = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
      .connect()
      .catch((err) => { globalThis.__agrishieldMongo = null; throw err; }); // retry on next request
  }
  const client = await globalThis.__agrishieldMongo;
  return client.db(process.env.MONGODB_DB || 'agrishield').collection('field_telemetry');
}

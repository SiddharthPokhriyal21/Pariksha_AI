import mongoose from 'mongoose';

let cheatingImagesBucket: mongoose.mongo.GridFSBucket | null = null;

/**
 * Returns a GridFS bucket for storing proctoring evidence images.
 * Bucket name: "cheatingImages"
 *
 * Make sure MongoDB is connected before calling this helper.
 */
export function getCheatingImagesBucket(): mongoose.mongo.GridFSBucket {
  if (!mongoose.connection.db) {
    throw new Error('MongoDB connection not ready. Cannot initialize GridFS bucket.');
  }

  if (!cheatingImagesBucket) {
    cheatingImagesBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'cheatingImages',
    });
  }

  return cheatingImagesBucket;
}



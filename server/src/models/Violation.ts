import mongoose, { Document, Schema } from 'mongoose';

export interface IViolation extends Document {
  studentId: string;
  testId: string;
  timestamp: Date;
  type: string;
  severity: 'low' | 'medium' | 'high';
  image: string; // Base64 encoded image or image path
  confidence?: number; // ML model confidence score
  description?: string;
  createdAt: Date;
}

const ViolationSchema = new Schema<IViolation>(
  {
    studentId: {
      type: String,
      required: [true, 'Student ID is required'],
      index: true,
    },
    testId: {
      type: String,
      required: [true, 'Test ID is required'],
      index: true,
    },
    timestamp: {
      type: Date,
      required: [true, 'Timestamp is required'],
      default: Date.now,
    },
    type: {
      type: String,
      required: [true, 'Violation type is required'],
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: [true, 'Severity is required'],
    },
    image: {
      type: String,
      required: [true, 'Image is required'],
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
    },
    description: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes for faster queries
ViolationSchema.index({ studentId: 1, testId: 1 });
ViolationSchema.index({ timestamp: -1 });

const Violation = mongoose.model<IViolation>('Violation', ViolationSchema);

export default Violation;


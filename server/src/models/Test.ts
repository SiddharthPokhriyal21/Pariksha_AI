import mongoose, { Document, Schema } from 'mongoose';

export type TestStatus = 'scheduled' | 'active' | 'completed' | 'running';

export interface ITest extends Document {
  // Existing fields used by current APIs
  name: string;
  description?: string;
  examinerId: string;
  status: TestStatus;
  duration: number; // Duration in minutes

  // New fields to align with normalized exam schema
  createdBy?: mongoose.Types.ObjectId;
  allowedStudents?: string[]; // allowed emails
  questionIds?: mongoose.Types.ObjectId[]; // reusable Question references
  startTime: Date;
  endTime: Date;

  createdAt: Date;
  updatedAt: Date;
}

const TestSchema = new Schema<ITest>(
  {
    name: {
      type: String,
      required: [true, 'Test name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    examinerId: {
      type: String,
      required: [true, 'Examiner ID is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['scheduled', 'active', 'completed', 'running'],
      default: 'scheduled',
    },
    duration: {
      type: Number,
      required: [true, 'Duration is required'],
      min: [1, 'Duration must be at least 1 minute'],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    allowedStudents: [
      {
        type: String,
      },
    ],
    questionIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Question',
      },
    ],
    startTime: {
      type: Date,
      required: [true, 'Start time is required'],
    },
    endTime: {
      type: Date,
      required: [true, 'End time is required'],
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes for faster queries
TestSchema.index({ examinerId: 1, status: 1 });
// New index for allowedStudents lookups (email based access)
TestSchema.index({ allowedStudents: 1 });
TestSchema.index({ startTime: 1, endTime: 1 });

const Test = mongoose.model<ITest>('Test', TestSchema);

export default Test;



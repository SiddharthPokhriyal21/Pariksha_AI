import mongoose, { Document, Schema } from 'mongoose';

export interface ITestRecording extends Document {
  studentId: string;
  testId: string;
  videoBlob: Buffer; // Video recording as binary data
  audioBlob: Buffer; // Audio recording as binary data
  videoMimeType: string; // e.g., 'video/webm'
  audioMimeType: string; // e.g., 'audio/webm'
  duration: number; // Duration in seconds
  startTime: Date;
  endTime: Date;
  answers: Record<string, string>; // Question answers
  violations: Array<{
    timestamp: Date;
    type: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const TestRecordingSchema = new Schema<ITestRecording>(
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
    videoBlob: {
      type: Buffer,
      required: [true, 'Video recording is required'],
    },
    audioBlob: {
      type: Buffer,
      required: [true, 'Audio recording is required'],
    },
    videoMimeType: {
      type: String,
      default: 'video/webm',
    },
    audioMimeType: {
      type: String,
      default: 'audio/webm',
    },
    duration: {
      type: Number,
      required: [true, 'Duration is required'],
    },
    startTime: {
      type: Date,
      required: [true, 'Start time is required'],
    },
    endTime: {
      type: Date,
      required: [true, 'End time is required'],
    },
    answers: {
      type: Map,
      of: String,
      default: {},
    },
    violations: [
      {
        timestamp: {
          type: Date,
          required: true,
        },
        type: {
          type: String,
          required: true,
        },
        severity: {
          type: String,
          enum: ['low', 'medium', 'high'],
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Create compound index for faster queries
TestRecordingSchema.index({ studentId: 1, testId: 1 });

const TestRecording = mongoose.model<ITestRecording>('TestRecording', TestRecordingSchema);

export default TestRecording;


import mongoose, { Document, Schema } from 'mongoose';

export interface IQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
}

export interface ITest extends Document {
  name: string;
  description?: string;
  examinerId: string;
  questions: IQuestion[];
  status: 'scheduled' | 'active' | 'completed';
  scheduledDate: Date;
  duration: number; // Duration in minutes
  enrolledStudents: string[]; // Array of student IDs
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
    questions: [
      {
        id: {
          type: Number,
          required: true,
        },
        question: {
          type: String,
          required: true,
        },
        options: {
          type: [String],
          required: true,
        },
        correctAnswer: {
          type: Number,
          required: true,
        },
      },
    ],
    status: {
      type: String,
      enum: ['scheduled', 'active', 'completed'],
      default: 'scheduled',
    },
    scheduledDate: {
      type: Date,
      required: [true, 'Scheduled date is required'],
    },
    duration: {
      type: Number,
      required: [true, 'Duration is required'],
      min: [1, 'Duration must be at least 1 minute'],
    },
    enrolledStudents: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes for faster queries
TestSchema.index({ examinerId: 1, status: 1 });
TestSchema.index({ enrolledStudents: 1, status: 1 });

const Test = mongoose.model<ITest>('Test', TestSchema);

export default Test;


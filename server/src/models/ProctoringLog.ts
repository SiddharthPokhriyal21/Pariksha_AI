import mongoose, { Document, Schema } from 'mongoose';

export type ProctoringLabel =
  | 'Phone Detected'
  | 'Multiple Faces'
  | 'No Person Visible'
  | 'Audio Detected'
  | 'Looking Away';

export type ProctoringSeverity = 'low' | 'medium' | 'high';

export interface IProctoringLog extends Document {
  attemptId: mongoose.Types.ObjectId;
  timestamp: Date;
  label: ProctoringLabel;
  severity: ProctoringSeverity;
  imageId?: mongoose.Types.ObjectId; // GridFS file ID
  createdAt: Date;
  updatedAt: Date;
}

const ProctoringLogSchema = new Schema<IProctoringLog>(
  {
    attemptId: {
      type: Schema.Types.ObjectId,
      ref: 'ExamAttempt',
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
    },
    label: {
      type: String,
      enum: ['Phone Detected', 'Multiple Faces', 'No Person Visible', 'Audio Detected', 'Looking Away'],
      required: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: true,
    },
    imageId: {
      type: Schema.Types.ObjectId,
    },
  },
  {
    timestamps: true,
  }
);

// Fast sorting & filtering
ProctoringLogSchema.index({ attemptId: 1 });
ProctoringLogSchema.index({ timestamp: 1 });

const ProctoringLog = mongoose.model<IProctoringLog>('ProctoringLog', ProctoringLogSchema);

export default ProctoringLog;



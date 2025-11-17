# MongoDB Database Schema - Pariksha AI

> Complete reference guide for all MongoDB collections, schemas, relationships, and storage mechanisms used in the Pariksha AI proctoring platform.

## Table of Contents

1. [Database Overview](#database-overview)
2. [All Collections](#all-collections)
3. [Detailed Schemas](#detailed-schemas)
4. [Indexes](#indexes)
5. [Data Relationships](#data-relationships)
6. [GridFS Storage](#gridfs-storage)
7. [Example Documents](#example-documents)
8. [Useful Queries](#useful-queries)

---

## Database Overview

**Database Name:** `pariksha_ai`

**Total Collections:** 7
- `users` - Student and examiner accounts
- `tests` - Test definitions created by examiners
- `questions` - Reusable question bank
- `examattempts` - Student exam submissions
- `proctoringlogs` - Violation records with timestamps
- `cheatingImages.files` - GridFS file metadata for violation images
- `cheatingImages.chunks` - GridFS binary data for violation images

---

## All Collections

| Collection | Purpose | Documents | Typical Size |
|---|---|---|---|
| `users` | User accounts | Hundreds | 2-5 KB each |
| `tests` | Test definitions | Dozens | 5-10 KB each |
| `questions` | Question bank | Hundreds | 3-8 KB each |
| `examattempts` | Student submissions | Thousands | 10-50 KB each |
| `proctoringlogs` | Violation logs | Thousands | 1-2 KB each |
| `cheatingImages.files` | GridFS image metadata | Thousands | 1 KB each |
| `cheatingImages.chunks` | GridFS image data | Thousands | 255 KB each |

---

## Detailed Schemas

### 1. `users` Collection

Stores all user accounts (students and examiners).

```typescript
{
  _id: ObjectId,                    // MongoDB auto-generated ID
  fullName: String,                 // User's full name (required)
  email: String,                    // Email (unique, required, lowercase)
  password: String,                 // Bcrypt hashed password (required)
  role: String,                     // 'student' or 'examiner' (enum, required)
  photo: String,                    // Base64 encoded face image (required)
  faceDescriptor: [Number],         // 128-dimensional face vector (required)
  createdAt: Date,                  // Auto-generated timestamp
  updatedAt: Date                   // Auto-updated timestamp
}
```

**Schema Rules:**
- `email` is unique across all users
- `password` is hashed using bcrypt with cost factor 10
- `faceDescriptor` is a numerical array used for face recognition matching
- `photo` is Base64 encoded for display in UI
- Roles: `student` or `examiner` (cannot be both simultaneously)

**Example Document:**
```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439011"),
  fullName: "John Doe",
  email: "john@example.com",
  password: "$2b$10$...",  // bcrypt hash
  role: "student",
  photo: "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  faceDescriptor: [0.234, -0.156, 0.897, ...],  // 128 numbers
  createdAt: ISODate("2024-11-10T08:00:00Z"),
  updatedAt: ISODate("2024-11-15T14:30:00Z")
}
```

---

### 2. `tests` Collection

Test definitions created by examiners. Tests can be assigned to specific students or open to all.

```typescript
{
  _id: ObjectId,
  name: String,                     // Test name (required)
  description: String,              // Optional description
  examinerId: String,               // String ID of examiner (required, indexed)
  status: String,                   // 'scheduled' | 'active' | 'completed' | 'running'
  duration: Number,                 // Duration in minutes (required, >= 1)
  createdBy: ObjectId,              // Reference to User (examiner)
  allowedStudents: [String],        // Array of student emails (empty = open to all)
  questionIds: [ObjectId],          // References to Question documents
  startTime: Date,                  // Test start time (required)
  endTime: Date,                    // Test end time (required)
  createdAt: Date,                  // Auto-generated timestamp
  updatedAt: Date                   // Auto-updated timestamp
}
```

**Schema Rules:**
- `duration` must be >= 1 minute
- `allowedStudents` array empty means test is visible to all authenticated students
- `questionIds` are references to Question documents (can be reused across tests)
- Test has both `examinerId` (string) and `createdBy` (ObjectId) for flexibility

**Indexes:**
- `{ examinerId: 1, status: 1 }`
- `{ allowedStudents: 1 }`
- `{ startTime: 1, endTime: 1 }`

**Example Document:**
```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439012"),
  name: "AI Fundamentals Quiz",
  description: "Mid-semester examination",
  examinerId: "507f1f77bcf86cd799439010",
  status: "active",
  duration: 60,
  createdBy: ObjectId("507f1f77bcf86cd799439010"),
  allowedStudents: ["student1@example.com", "student2@example.com"],
  questionIds: [
    ObjectId("507f1f77bcf86cd799439013"),
    ObjectId("507f1f77bcf86cd799439014")
  ],
  startTime: ISODate("2024-11-20T10:00:00Z"),
  endTime: ISODate("2024-11-20T11:00:00Z"),
  createdAt: ISODate("2024-11-15T08:00:00Z"),
  updatedAt: ISODate("2024-11-20T10:05:00Z")
}
```

---

### 3. `questions` Collection

Reusable question bank. Questions can be MCQ, subjective, or coding.

```typescript
{
  _id: ObjectId,
  type: String,                     // 'mcq' | 'coding' | 'subjective'
  questionText: String,             // The question text (required)
  options: [String],                // MCQ options (required for MCQ)
  correctAnswer: Mixed,             // Answer (varies by type)
  marks: Number,                    // Default 1 mark
  sampleInput: String,              // For coding questions
  sampleOutput: String,             // For coding questions
  constraints: String,              // For coding questions
  codingStarterCode: String,        // Initial code template
  codingFunctionSignature: String,  // Function signature for coding
  codingTestCases: [                // Array of test cases
    {
      input: String,
      output: String,
      explanation: String
    }
  ],
  subjectiveRubric: String,         // Grading rubric for subjective
  referenceAnswer: String,          // Reference/sample answer
  createdBy: ObjectId,              // Reference to User (examiner)
  createdAt: Date,
  updatedAt: Date
}
```

**Question Types:**

**MCQ (Multiple Choice):**
```javascript
{
  type: "mcq",
  questionText: "What is 2 + 2?",
  options: ["3", "4", "5", "6"],
  correctAnswer: "4",
  marks: 1
}
```

**Subjective:**
```javascript
{
  type: "subjective",
  questionText: "Explain the concept of AI in your own words",
  marks: 5,
  subjectiveRubric: "Evaluate based on clarity, depth, and correctness",
  referenceAnswer: "AI is intelligence demonstrated by machines..."
}
```

**Coding:**
```javascript
{
  type: "coding",
  questionText: "Write a function to find the sum of array elements",
  marks: 10,
  codingStarterCode: "def sum_array(arr):\n    # Your code here\n    pass",
  codingFunctionSignature: "def sum_array(arr: List[int]) -> int",
  sampleInput: "[1, 2, 3, 4, 5]",
  sampleOutput: "15",
  codingTestCases: [
    { input: "[1, 2, 3]", output: "6", explanation: "Sum of elements" },
    { input: "[]", output: "0", explanation: "Empty array" }
  ]
}
```

**Indexes:**
- `{ createdBy: 1 }`

---

### 4. `examattempts` Collection

Each exam attempt represents a student taking a test. One attempt per student per test.

```typescript
{
  _id: ObjectId,
  testId: ObjectId,                 // Reference to Test (required)
  studentId: ObjectId,              // Reference to Student User (required)
  status: String,                   // 'not-started' | 'in-progress' | 'submitted'
  startedAt: Date,                  // When student started the test
  endedAt: Date,                    // When student submitted
  duration: Number,                 // Time taken in seconds
  answers: [                        // Array of student answers
    {
      questionId: ObjectId,         // Which question
      answer: Mixed,                // Student's answer (string, array, etc)
      isCorrect: Boolean,           // MCQ auto-grading
      marksObtained: Number         // Marks for this question
    }
  ],
  totalScore: Number,               // Total marks obtained
  trustScore: Number,               // Proctoring trust score (0-100)
  totalViolations: Number,          // Count of violations detected
  questionsAttempted: Number,       // Questions answered
  createdAt: Date,
  updatedAt: Date
}
```

**Schema Rules:**
- Unique constraint: `{ testId: 1, studentId: 1 }` (one attempt per student per test)
- `trustScore` starts at 100 and decreases with each violation
- `status` workflow: `not-started` → `in-progress` → `submitted`
- Answers stored as-is; MCQ answers are auto-graded on submission

**Example Document:**
```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439020"),
  testId: ObjectId("507f1f77bcf86cd799439012"),
  studentId: ObjectId("507f1f77bcf86cd799439011"),
  status: "submitted",
  startedAt: ISODate("2024-11-20T10:00:00Z"),
  endedAt: ISODate("2024-11-20T10:45:30Z"),
  duration: 2730,  // 45 minutes 30 seconds
  answers: [
    {
      questionId: ObjectId("507f1f77bcf86cd799439013"),
      answer: "4",
      isCorrect: true,
      marksObtained: 1
    },
    {
      questionId: ObjectId("507f1f77bcf86cd799439014"),
      answer: "def sum_array(arr):\n    return sum(arr)",
      isCorrect: null,  // needs manual grading
      marksObtained: null
    }
  ],
  totalScore: 18,
  trustScore: 85,       // Reduced from 100 due to 2 violations
  totalViolations: 2,
  questionsAttempted: 2,
  createdAt: ISODate("2024-11-20T10:00:00Z"),
  updatedAt: ISODate("2024-11-20T10:45:30Z")
}
```

**Indexes:**
- `{ testId: 1, studentId: 1 }` (unique)

---

### 5. `proctoringlogs` Collection

Violation records detected during exams. Each entry represents one violation event.

```typescript
{
  _id: ObjectId,
  attemptId: ObjectId,              // Reference to ExamAttempt (required)
  timestamp: Date,                  // When violation was detected (required)
  label: String,                    // Type of violation (enum, required)
  severity: String,                 // 'low' | 'medium' | 'high' (enum)
  imageId: ObjectId,                // GridFS file ID of violation screenshot
  createdAt: Date,
  updatedAt: Date
}
```

**Violation Types (label):**
- `Phone Detected` - Phone/tablet detected in frame
- `Multiple Faces` - More than one person in frame
- `No Person Visible` - Student left frame (absence)
- `Audio Detected` - Background audio/voices detected
- `Looking Away` - Student looking away from screen

**Severity Levels:**
- `low` - Warning level (e.g., looking away for <5s)
- `medium` - Concerning (e.g., phone partially visible)
- `high` - Critical (e.g., phone used directly, multiple people)

**Impact on Trust Score:**
- Low: -2 points per violation
- Medium: -5 points per violation
- High: -10 points per violation

**Example Document:**
```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439030"),
  attemptId: ObjectId("507f1f77bcf86cd799439020"),
  timestamp: ISODate("2024-11-20T10:15:30Z"),
  label: "Phone Detected",
  severity: "high",
  imageId: ObjectId("507f1f77bcf86cd799439031"),
  createdAt: ISODate("2024-11-20T10:15:32Z"),
  updatedAt: ISODate("2024-11-20T10:15:32Z")
}
```

**Indexes:**
- `{ attemptId: 1 }`
- `{ timestamp: 1 }`

---

### 6. GridFS - `cheatingImages.files` Collection

Metadata for violation image files stored in GridFS.

```typescript
{
  _id: ObjectId,                    // Unique file ID
  filename: String,                 // Filename (e.g., "violation_1234567.jpg")
  uploadDate: Date,                 // Upload timestamp
  contentType: String,              // MIME type (e.g., "image/jpeg")
  length: Number,                   // File size in bytes
  chunkSize: Number,                // Chunk size (usually 261120 = 255KB)
  metadata: {                       // Custom metadata
    attemptId: ObjectId,            // Exam attempt reference
    timestamp: Date,                // When violation occurred
    label: String,                  // Violation type
    severity: String                // Violation severity
  }
}
```

**Example Document:**
```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439031"),
  filename: "violation_1700483730000.jpg",
  uploadDate: ISODate("2024-11-20T10:15:32Z"),
  contentType: "image/jpeg",
  length: 234567,  // ~234 KB
  chunkSize: 261120,  // 255 KB standard
  metadata: {
    attemptId: ObjectId("507f1f77bcf86cd799439020"),
    timestamp: ISODate("2024-11-20T10:15:30Z"),
    label: "Phone Detected",
    severity: "high"
  }
}
```

---

### 7. GridFS - `cheatingImages.chunks` Collection

Binary data chunks of violation images (GridFS internal).

```typescript
{
  _id: ObjectId,                    // Unique chunk ID
  files_id: ObjectId,               // Reference to cheatingImages.files._id
  n: Number,                        // Chunk number (0, 1, 2, ...)
  data: BinData(...)                // Binary image data (up to 255KB)
}
```

**Example Document:**
```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439050"),
  files_id: ObjectId("507f1f77bcf86cd799439031"),
  n: 0,
  data: BinData(...)  // First 255KB of image
}
{
  _id: ObjectId("507f1f77bcf86cd799439051"),
  files_id: ObjectId("507f1f77bcf86cd799439031"),
  n: 1,
  data: BinData(...)  // Remaining image data
}
```

---

## Indexes

### All Indexes by Collection

| Collection | Index | Fields | Unique | Reason |
|---|---|---|---|---|
| `users` | primary | `_id` | ✓ | Auto-generated |
| `users` | email | `email` | ✓ | Login lookup |
| `tests` | primary | `_id` | ✓ | Auto-generated |
| `tests` | examiner_status | `examinerId, status` | ✗ | Query by examiner |
| `tests` | allowed_students | `allowedStudents` | ✗ | Student access check |
| `tests` | time_range | `startTime, endTime` | ✗ | Active tests query |
| `questions` | primary | `_id` | ✓ | Auto-generated |
| `questions` | creator | `createdBy` | ✗ | Examiner's questions |
| `examattempts` | primary | `_id` | ✓ | Auto-generated |
| `examattempts` | unique_attempt | `testId, studentId` | ✓ | One per student per test |
| `proctoringlogs` | primary | `_id` | ✓ | Auto-generated |
| `proctoringlogs` | by_attempt | `attemptId` | ✗ | Find violations per attempt |
| `proctoringlogs` | by_timestamp | `timestamp` | ✗ | Timeline queries |

---

## Data Relationships

### Entity Relationship Diagram

```
┌─────────────────────┐
│      Users          │
│  _id (student/exam) │
└──────────┬──────────┘
           │
      ┌────┴────┐
      │         │
      ▼         ▼
┌──────────┐  ┌──────────────┐
│  Tests   │  │  Questions   │
│ (_id)    │  │   (_id)      │
└────┬─────┘  └──────────────┘
     │            │
     │    (referenced in)
     │            │
     ▼            ▼
┌───────────────────────────────┐
│    ExamAttempts               │
│    (studentId, testId)        │
│    - answers: []              │
│    - trustScore: 100          │
└───────────┬───────────────────┘
            │
    ┌───────┴──────────┐
    │                  │
    ▼                  ▼
┌─────────────┐   ┌──────────────────┐
│ProctoringLog│   │  Violations      │
│(attemptId)  │   │ (studentId/testId)
└──────┬──────┘   └──────────────────┘
       │
       │ (imageId)
       │
       ▼
┌──────────────────────────┐
│  cheatingImages.files    │
│  (GridFS metadata)       │
└──────────────┬───────────┘
               │
               │ (files_id)
               │
               ▼
┌──────────────────────────┐
│ cheatingImages.chunks    │
│ (GridFS binary data)     │
└──────────────────────────┘
```

### Key Relationships

**User → Tests**
- One examiner creates many tests
- `tests.createdBy` references `users._id`

**Tests → Questions**
- One test contains many questions
- `tests.questionIds` array contains `questions._id` references

**User → ExamAttempt**
- One student has one exam attempts
- `examattempts.studentId` references `users._id`

**Test → ExamAttempt**
- One test can have many student attempts
- `examattempts.testId` references `tests._id`

**ExamAttempt → ProctoringLog**
- One exam attempt has many violation logs
- `proctoringlogs.attemptId` references `examattempts._id`

**ProctoringLog → GridFS Images**
- One violation log can have one evidence image
- `proctoringlogs.imageId` references `cheatingImages.files._id`

**GridFS Files → Chunks**
- One file is split into multiple chunks
- `cheatingImages.chunks.files_id` references `cheatingImages.files._id`

---

## GridFS Storage

### Understanding GridFS

GridFS is MongoDB's solution for storing files larger than 16MB (or any file when efficiency matters).

### How it Works

When you upload a violation image:

1. **File metadata** stored in `cheatingImages.files`
2. **File data** split into 255KB chunks
3. Each chunk stored in `cheatingImages.chunks` with a reference (`files_id`) back to the file

### Storage Example

**Original image:** 300 KB JPEG

**After GridFS storage:**

```
cheatingImages.files:
{
  _id: ObjectId("file123"),
  filename: "violation_1700483730000.jpg",
  length: 307200,  // 300 KB
  chunkSize: 261120,  // 255 KB
  uploadDate: ...
}

cheatingImages.chunks:
[
  {
    _id: ObjectId("chunk1"),
    files_id: ObjectId("file123"),
    n: 0,
    data: <255 KB of image data>
  },
  {
    _id: ObjectId("chunk2"),
    files_id: ObjectId("file123"),
    n: 1,
    data: <45 KB of remaining data>
  }
]
```

### Why GridFS?

- **Efficiency:** Don't load entire image into memory
- **Scalability:** Store terabytes of image evidence
- **Metadata:** Attach context (attemptId, violation type, severity)
- **Automatic cleanup:** Delete files and all chunks together

---

## Example Documents

### Complete Exam Attempt Flow

**1. Student starts test:**
```javascript
// User document
db.users.findOne({ email: "student@example.com" })
→ { _id: ObjectId("stu001"), fullName: "John Doe", role: "student", ... }

// Test document
db.tests.findOne({ name: "AI Fundamentals Quiz" })
→ { _id: ObjectId("test001"), questionIds: [ObjectId("q1"), ObjectId("q2")], ... }

// ExamAttempt created
db.examattempts.insertOne({
  _id: ObjectId("attempt001"),
  testId: ObjectId("test001"),
  studentId: ObjectId("stu001"),
  status: "in-progress",
  startedAt: ISODate("2024-11-20T10:00:00Z"),
  trustScore: 100,
  totalViolations: 0,
  answers: []
})
```

**2. Violation detected:**
```javascript
// ML model detects phone
// 1. Save violation image to GridFS
db.getCollection("cheatingImages.files").insertOne({
  _id: ObjectId("img001"),
  filename: "violation_1700483730000.jpg",
  uploadDate: ISODate("2024-11-20T10:15:32Z"),
  contentType: "image/jpeg",
  length: 234567,
  metadata: {
    attemptId: ObjectId("attempt001"),
    timestamp: ISODate("2024-11-20T10:15:30Z"),
    label: "Phone Detected",
    severity: "high"
  }
})

// 2. Create ProctoringLog
db.proctoringlogs.insertOne({
  _id: ObjectId("vlog001"),
  attemptId: ObjectId("attempt001"),
  timestamp: ISODate("2024-11-20T10:15:30Z"),
  label: "Phone Detected",
  severity: "high",
  imageId: ObjectId("img001")
})

// 3. Update ExamAttempt
db.examattempts.updateOne(
  { _id: ObjectId("attempt001") },
  {
    $inc: { totalViolations: 1 },
    $set: { trustScore: 90 }  // 100 - 10 for high severity
  }
)
```

**3. Student submits:**
```javascript
// Final ExamAttempt state
db.examattempts.findOne({ _id: ObjectId("attempt001") })
→ {
  _id: ObjectId("attempt001"),
  testId: ObjectId("test001"),
  studentId: ObjectId("stu001"),
  status: "submitted",
  startedAt: ISODate("2024-11-20T10:00:00Z"),
  endedAt: ISODate("2024-11-20T10:45:30Z"),
  answers: [
    { questionId: ObjectId("q1"), answer: "4", marksObtained: 1 },
    { questionId: ObjectId("q2"), answer: "...", marksObtained: null }
  ],
  totalScore: 18,
  trustScore: 85,  // Could be lower if more violations
  totalViolations: 3
}
```

---

## Useful Queries

### User Queries

**Find user by email:**
```javascript
db.users.findOne({ email: "student@example.com" })
```

**Find all examiners:**
```javascript
db.users.find({ role: "examiner" })
```

**Count total students:**
```javascript
db.users.countDocuments({ role: "student" })
```

### Test Queries

**Find all tests by examiner:**
```javascript
db.tests.find({ examinerId: ObjectId("examiner123") })
```

**Find tests available to a student:**
```javascript
// Tests with this student's email OR tests open to all
db.tests.find({
  $or: [
    { allowedStudents: "student@example.com" },
    { allowedStudents: { $size: 0 } }  // empty array
  ]
})
```

**Find active tests:**
```javascript
db.tests.find({ status: "active" })
```

### ExamAttempt Queries

**Find all attempts by a student:**
```javascript
db.examattempts.find({ studentId: ObjectId("stu001") })
```

**Find attempts for a specific test:**
```javascript
db.examattempts.find({ testId: ObjectId("test001") })
```

**Find all attempts with trust score < 50:**
```javascript
db.examattempts.find({ trustScore: { $lt: 50 } })
```

**Get statistics for a test:**
```javascript
db.examattempts.aggregate([
  { $match: { testId: ObjectId("test001") } },
  {
    $group: {
      _id: null,
      avgScore: { $avg: "$totalScore" },
      avgTrustScore: { $avg: "$trustScore" },
      totalAttempts: { $sum: 1 },
      highViolations: {
        $sum: { $cond: [{ $gt: ["$totalViolations", 0] }, 1, 0] }
      }
    }
  }
])
```

### ProctoringLog Queries

**Find all violations for an attempt:**
```javascript
db.proctoringlogs.find({ attemptId: ObjectId("attempt001") })
  .sort({ timestamp: 1 })
```

**Find high-severity violations:**
```javascript
db.proctoringlogs.find({ severity: "high" })
```

**Count phone detections:**
```javascript
db.proctoringlogs.countDocuments({ label: "Phone Detected" })
```

**Find violations in a time range:**
```javascript
db.proctoringlogs.find({
  timestamp: {
    $gte: ISODate("2024-11-20T10:00:00Z"),
    $lte: ISODate("2024-11-20T11:00:00Z")
  }
})
```

**Get violation summary by attempt:**
```javascript
db.proctoringlogs.aggregate([
  { $match: { attemptId: ObjectId("attempt001") } },
  {
    $group: {
      _id: "$label",
      count: { $sum: 1 },
      avgSeverity: { $avg: { $cond: [{ $eq: ["$severity", "high"] }, 3, { $cond: [{ $eq: ["$severity", "medium"] }, 2, 1] }] } }
    }
  },
  { $sort: { count: -1 } }
])
```

### GridFS Queries

**Find violation images for an attempt:**
```javascript
// Get all images for an attempt
db.getCollection("cheatingImages.files")
  .find({ "metadata.attemptId": ObjectId("attempt001") })
```

**Find images by violation type:**
```javascript
db.getCollection("cheatingImages.files")
  .find({ "metadata.label": "Phone Detected" })
```

**Get image with its chunks:**
```javascript
const file = db.getCollection("cheatingImages.files")
  .findOne({ _id: ObjectId("img001") });

const chunks = db.getCollection("cheatingImages.chunks")
  .find({ files_id: ObjectId("img001") })
  .sort({ n: 1 });
```

### Complex Queries

**Student report: All violations during exam:**
```javascript
// Find exam attempt
const attempt = db.examattempts.findOne({
  studentId: ObjectId("stu001"),
  testId: ObjectId("test001")
});

// Find all violations
const violations = db.proctoringlogs.find({
  attemptId: attempt._id
}).toArray();

// For each violation, get the image
violations.forEach(v => {
  const image = db.getCollection("cheatingImages.files")
    .findOne({ _id: v.imageId });
  console.log(`${v.timestamp}: ${v.label} (${v.severity})`);
});
```

**Examiner dashboard: Test analytics:**
```javascript
db.examattempts.aggregate([
  { $match: { testId: ObjectId("test001") } },
  {
    $lookup: {
      from: "users",
      localField: "studentId",
      foreignField: "_id",
      as: "student"
    }
  },
  {
    $lookup: {
      from: "proctoringlogs",
      localField: "_id",
      foreignField: "attemptId",
      as: "violations"
    }
  },
  {
    $project: {
      studentName: { $arrayElemAt: ["$student.fullName", 0] },
      score: "$totalScore",
      trustScore: "$trustScore",
      violationCount: { $size: "$violations" },
      duration: "$duration"
    }
  },
  { $sort: { trustScore: 1 } }
])
```

---

## Database Maintenance

### Backup

```bash
# Full database backup
mongodump --uri="mongodb://localhost:27017/pariksha_ai" --out=./backup

# Specific collection
mongodump --uri="mongodb://localhost:27017/pariksha_ai" --collection=proctoringlogs --out=./backup
```

### Restore

```bash
# Full database restore
mongorestore --uri="mongodb://localhost:27017/pariksha_ai" ./backup/pariksha_ai

# Specific collection
mongorestore --uri="mongodb://localhost:27017/pariksha_ai" --collection=proctoringlogs ./backup/pariksha_ai/proctoringlogs.bson
```

### Cleanup GridFS

```javascript
// Delete a violation image and all its chunks
const fileId = ObjectId("img001");
db.getCollection("cheatingImages.files").deleteOne({ _id: fileId });
db.getCollection("cheatingImages.chunks").deleteMany({ files_id: fileId });
```

### Collection Statistics

```javascript
// Size of each collection
db.users.stats()
db.tests.stats()
db.examattempts.stats()
db.proctoringlogs.stats()
db.getCollection("cheatingImages.files").stats()

// Total database size
db.stats()
```

---

## Key Takeaways

| Aspect | Details |
|--------|---------|
| **Database** | MongoDB `pariksha_ai` |
| **Collections** | 7 total (5 primary + 2 GridFS) |
| **Total Documents** | Thousands per deployment |
| **Largest Collection** | `proctoringlogs` and `cheatingImages.chunks` (violation images) |
| **Critical Relationship** | `ExamAttempt` → `ProctoringLog` → `GridFS Images` |
| **Trust Score** | Starts at 100, decreases with violations |
| **Image Storage** | GridFS with 255KB chunks |
| **Indexing** | Optimized for queryby attempt, student, test, timestamp |

---

**Last Updated:** November 17, 2025 | **Version:** 1.0.0

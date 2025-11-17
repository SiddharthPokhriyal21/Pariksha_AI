// server/src/server.ts
import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables from .env file FIRST, before importing other modules
dotenv.config();

import mongoose from 'mongoose';
import User from './models/User';
import Test from './models/Test';
import Violation from './models/Violation';
import Question from './models/Question';
import ExamAttempt from './models/ExamAttempt';
import ProctoringLog from './models/ProctoringLog';
import { loadFaceModels, validateFace, compareFaces } from './utils/faceRecognition';
import { processVideoChunkWithML, extractFrameFromVideo } from './utils/mlProctoring';
import { getCheatingImagesBucket } from './utils/gridfs';

const app = express();
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8080');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;

// --- Mock Database (Simulating data storage) ---
interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
}

interface Test {
  id: number;
  name: string;
  questions: Question[];
  status: 'scheduled' | 'completed';
  date: string;
  studentsEnrolled: number;
}

interface StudentResult {
  id: number;
  name: string;
  email: string;
  actualScore: number; 
  trustScore: number; 
  violationsCount: number;
}

const MOCK_DB = {
  users: [] as { id: number, fullName: string, email: string, password: string, role: 'student' | 'examiner', photo: string }[],
  // tests are now fully sourced from MongoDB; this array is kept for backward-compatible types only
  tests: [] as Test[],
  results: [
    { id: 1, name: "Alice Johnson", email: "alice@example.com", actualScore: 95, trustScore: 98, violationsCount: 0 },
    { id: 2, name: "Bob Smith", email: "bob@example.com", actualScore: 87, trustScore: 75, violationsCount: 3 },
    { id: 3, name: "Charlie Brown", email: "charlie@example.com", actualScore: 92, trustScore: 95, violationsCount: 1 },
    { id: 4, name: "Diana Prince", email: "diana@example.com", actualScore: 78, trustScore: 85, violationsCount: 2 },
    { id: 5, name: "Ethan Hunt", email: "ethan@example.com", actualScore: 89, trustScore: 92, violationsCount: 1 },
  ] as StudentResult[],
  violations: [
    { time: "10:15:23", type: "Multiple Faces Detected", severity: "high", studentId: 2, testId: 2 },
    { time: "10:22:45", type: "Looking Away", severity: "medium", studentId: 2, testId: 2 },
    { time: "10:35:12", type: "Phone Detected", severity: "high", studentId: 2, testId: 2 },
  ]
};

// --- Middleware ---
// Allows frontend running on different port (e.g., 8080) to connect
// CORS configuration - allow requests from frontend
const corsOptions = {
  origin: function (origin: string | undefined, callback: Function) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin matches CORS_ORIGIN or allow localhost for development
    if (!CORS_ORIGIN || origin === CORS_ORIGIN || origin.includes('localhost')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions)); 
// Parses JSON bodies, increasing limit to handle base64 videos/audio
app.use(bodyParser.json({ limit: '500mb' })); 

// --- Utility Functions ---
const getNextId = (arr: any[]) => (arr.length ? Math.max(...arr.map(i => i.id)) + 1 : 1);


// Endpoint to trigger model loading (called from homepage)
app.get('/api/load-models', async (req: Request, res: Response) => {
  try {
    await loadFaceModels();
    res.status(200).json({ message: 'Models loaded successfully' });
  } catch (error: any) {
    res.status(500).json({ 
      message: 'Failed to load models',
      error: error.message 
    });
  }
});

// ===============================
//         AUTH ROUTES
// ===============================

// Handles registration from StudentRegister.tsx and ExaminerRegister.tsx
app.post('/api/auth/:role/register', async (req: Request, res: Response) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        message: 'Database connection not available. Please try again later.',
        error: 'DATABASE_UNAVAILABLE'
      });
    }

    const { role } = req.params;
    const { fullName, email, password, photo } = req.body;

    // Validate input
    if (!fullName || !email || !password || !photo) {
      return res.status(400).json({ 
        message: 'All fields are required.',
        error: 'MISSING_FIELDS'
      });
    }

    // Validate role
    if (role !== 'student' && role !== 'examiner') {
      return res.status(400).json({ 
        message: 'Invalid role. Must be "student" or "examiner".',
        error: 'INVALID_ROLE'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        message: 'Please provide a valid email address.',
        error: 'INVALID_EMAIL'
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ 
        message: 'Password must be at least 6 characters long.',
        error: 'INVALID_PASSWORD'
      });
    }

    // Check if user already exists in MongoDB (email must be unique globally)
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ 
        message: `User with email ${email} already exists. Please use a different email.`,
        error: 'USER_EXISTS'
      });
    }

    // Validate and extract face descriptor from photo
    const faceValidation = await validateFace(photo);
    if (!faceValidation.success || !faceValidation.descriptor) {
      return res.status(400).json({
        message: faceValidation.error || 'Face validation failed.',
        error: 'FACE_VALIDATION_FAILED',
        details: faceValidation.error
      });
    }

    // Convert Float32Array to regular array for MongoDB storage
    const faceDescriptorArray = Array.from(faceValidation.descriptor);

    // Create new user (password will be hashed by the pre-save hook)
    const newUser = new User({
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: role as 'student' | 'examiner',
      photo,
      faceDescriptor: faceDescriptorArray,
    });

    // Save to MongoDB
    await newUser.save();

    // Return success response (don't send password or face descriptor)
    res.status(201).json({ 
      message: 'Registration successful', 
      userId: (newUser._id as any).toString(), 
      role: newUser.role,
      email: newUser.email
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    
    // Handle duplicate key error (MongoDB unique constraint)
    if (error.code === 11000) {
      return res.status(409).json({ 
        message: 'User with this email already exists for this role.',
        error: 'USER_EXISTS'
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const firstError = Object.values(error.errors)[0] as any;
      return res.status(400).json({ 
        message: firstError?.message || 'Validation failed',
        error: 'VALIDATION_ERROR'
      });
    }
    
    // Handle MongoDB connection errors
    if (error.name === 'MongoServerError' || error.name === 'MongoNetworkError') {
      return res.status(503).json({ 
        message: 'Database connection error. Please try again later.',
        error: 'DATABASE_ERROR'
      });
    }
    
    res.status(500).json({ 
      message: 'Registration failed. Please try again.',
      error: 'INTERNAL_ERROR'
    });
  }
});

// Handles login from StudentLogin.tsx and ExaminerLogin.tsx
app.post('/api/auth/:role/login', async (req: Request, res: Response) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        message: 'Database connection not available. Please try again later.',
        error: 'DATABASE_UNAVAILABLE'
      });
    }

    const { role } = req.params;
    const { email, password, photo } = req.body; // 'photo' is for face verification

    // Validate input
    if (!email || !password || !photo) {
      return res.status(400).json({ 
        message: 'Email, password, and photo are required.',
        error: 'MISSING_FIELDS'
      });
    }

    // Validate role
    if (role !== 'student' && role !== 'examiner') {
      return res.status(400).json({ 
        message: 'Invalid role. Must be "student" or "examiner".',
        error: 'INVALID_ROLE'
      });
    }

    // Find user in MongoDB
    const user = await User.findOne({ email: email.toLowerCase().trim(), role });
    
    if (!user) {
      return res.status(401).json({ 
        message: 'Invalid email or password.',
        error: 'INVALID_CREDENTIALS'
      });
    }

    // Verify password using bcrypt comparison
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: 'Invalid email or password.',
        error: 'INVALID_CREDENTIALS'
      });
    }

    // Validate and extract face descriptor from login photo
    const faceValidation = await validateFace(photo);
    if (!faceValidation.success || !faceValidation.descriptor) {
      return res.status(400).json({
        message: faceValidation.error || 'Face validation failed. Please ensure your face is clearly visible.',
        error: 'FACE_DETECTION_FAILED',
        details: faceValidation.error
      });
    }

    // Verify face descriptor exists in user record
    if (!user.faceDescriptor || !Array.isArray(user.faceDescriptor) || user.faceDescriptor.length === 0) {
      return res.status(500).json({
        message: 'Face data not found for this user. Please contact support.',
        error: 'FACE_DATA_MISSING'
      });
    }

    // Compare face with stored face descriptor
    const storedDescriptor = new Float32Array(user.faceDescriptor);
    const faceMatch = compareFaces(faceValidation.descriptor, storedDescriptor);

    if (!faceMatch) {
      return res.status(401).json({
        message: 'Face verification failed. The photo does not match your registered face.',
        error: 'FACE_MISMATCH'
      });
    }
    
    // Success - return user info (without password or face descriptor)
    res.status(200).json({ 
      message: 'Authentication Successful!', 
      user: { 
        id: (user._id as any).toString(), 
        name: user.fullName, 
        role: user.role,
        email: user.email
      } 
    });
  } catch (error: any) {
    console.error('Login error:', error);
    
    // Handle MongoDB connection errors
    if (error.name === 'MongoServerError' || error.name === 'MongoNetworkError') {
      return res.status(503).json({ 
        message: 'Database connection error. Please try again later.',
        error: 'DATABASE_ERROR'
      });
    }
    
    res.status(500).json({ 
      message: 'Login failed. Please try again.',
      error: 'INTERNAL_ERROR'
    });
  }
});


// ===============================
//         EXAMINER ROUTES
// ===============================

// Fetches data for ExaminerDashboard.tsx (now fully backed by MongoDB, no hardcoded tests)
app.get('/api/examiner/dashboard', async (req: Request, res: Response) => {
  try {
    const [totalTests, completedTests, scheduledTests, studentCount, recentTests] = await Promise.all([
      Test.countDocuments({}),
      Test.countDocuments({ status: 'completed' }),
      Test.countDocuments({ status: { $in: ['scheduled', 'active', 'running'] } }),
      User.countDocuments({ role: 'student' }),
      Test.find({}).sort({ createdAt: -1 }).limit(10),
    ]);

    const activeStudents = studentCount;

    const dashboardData = {
      stats: [
        { label: 'Total Tests', value: totalTests.toString(), color: 'primary' },
        { label: 'Active Students', value: activeStudents.toString(), color: 'secondary' },
        { label: 'Completed', value: completedTests.toString(), color: 'success' },
        { label: 'Scheduled', value: scheduledTests.toString(), color: 'warning' },
      ],
      tests: recentTests.map((t) => ({
        id: (t._id as any).toString(),
        name: t.name,
        date: t.startTime ? t.startTime.toISOString().split('T')[0] : '',
        students: t.allowedStudents?.length || 0,
        status: t.status,
      })),
    };

    res.status(200).json(dashboardData);
  } catch (error: any) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard data.' });
  }
});

// Used by CreateTest.tsx to save a new test
app.post('/api/examiner/tests', async (req: Request, res: Response) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: 'Database connection not available. Please try again later.',
        error: 'DATABASE_UNAVAILABLE',
      });
    }

    const { testName, description, questions, duration, allowedStudents, examinerId, startTime, endTime } = req.body;

    if (!testName || !questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        message: 'Test name and questions are required.',
        error: 'MISSING_FIELDS',
      });
    }

    // Get examiner ID from request (you may need to add authentication middleware)
    const examiner = examinerId || 'unknown'; // TODO: Get from auth token

    // Persist reusable questions in dedicated collection and collect their IDs
    const createdQuestions = await Promise.all(
      questions.map((q: any) =>
        new Question({
          type: q.type || 'mcq',
          questionText: q.question,
          options: q.type === 'mcq' ? q.options : [],
          correctAnswer: q.type === 'mcq' ? q.correctAnswer : q.correctAnswer ?? null,
          marks: typeof q.marks === 'number' ? q.marks : 1,
          sampleInput: q.sampleInput,
          sampleOutput: q.sampleOutput,
          constraints: q.constraints,
          codingStarterCode: q.codingStarterCode,
          codingFunctionSignature: q.codingFunctionSignature,
          codingTestCases: q.codingTestCases,
          subjectiveRubric: q.subjectiveRubric,
          referenceAnswer: q.referenceAnswer,
          createdBy: examiner,
        }).save()
      )
    );

    const questionIds = createdQuestions.map((q) => q._id);

    const start = startTime
      ? new Date(startTime)
      : new Date();
    const end = endTime
      ? new Date(endTime)
      : new Date(start.getTime() + (duration || 60) * 60 * 1000);

    // Create test in MongoDB
    const newTest = new Test({
      name: testName,
      description: description || '',
      examinerId: examiner,
      status: 'scheduled',
      duration: duration || 60, // Default 60 minutes
      createdBy: examiner,
      questionIds,
      allowedStudents: Array.isArray(allowedStudents)
        ? allowedStudents.map((email: string) => email.toLowerCase().trim()).filter(Boolean)
        : [],
      startTime: start,
      endTime: end,
    });

    await newTest.save();

    res.status(201).json({
      message: 'Test created successfully',
      testId: (newTest._id as any).toString(),
      mongoTestId: (newTest._id as any).toString(),
    });
  } catch (error: any) {
    console.error('Create test error:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Validation failed',
        error: 'VALIDATION_ERROR',
      });
    }

    res.status(500).json({
      message: 'Failed to create test. Please try again.',
      error: 'INTERNAL_ERROR',
    });
  }
});

// AI generation API for CreateTest.tsx
app.post('/api/examiner/ai-generate', async (req: Request, res: Response) => {
    const { aiPrompt } = req.body;

    if (!aiPrompt || aiPrompt.trim().length === 0) {
        return res.status(400).json({ message: 'AI prompt is required' });
    }

    // Check if any AI API key is available
    if (!OPENAI_API_KEY && !ANTHROPIC_API_KEY) {
        // Fallback to mock response if no API keys are configured
        console.warn('No AI API keys configured. Using mock response.');
        const mockQuestions: Question[] = [
            { id: 1, question: "AI-Generated Q1: What is the derivative of x^2?", options: ["x", "2x", "2", "x/2"], correctAnswer: 1 },
            { id: 2, question: "AI-Generated Q2: Solve ∫(1/x) dx.", options: ["e^x", "x^2", "ln|x|", "1"], correctAnswer: 2 },
        ];
        
        setTimeout(() => {
            res.status(200).json({ 
                message: "AI generation complete (mock mode). Review questions below.", 
                questions: mockQuestions 
            });
        }, 1500);
        return;
    }

    try {
        let questions: Question[] = [];

        // Try OpenAI first if available
        if (OPENAI_API_KEY) {
            try {
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${OPENAI_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-4',
                        messages: [
                            {
                                role: 'system',
                                content: 'You are an expert test question generator. Generate multiple choice questions in JSON format. Return only valid JSON with this structure: [{"question": "question text", "options": ["option1", "option2", "option3", "option4"], "correctAnswer": 0}] where correctAnswer is the index (0-3).'
                            },
                            {
                                role: 'user',
                                content: aiPrompt
                            }
                        ],
                        temperature: 0.7,
                        max_tokens: 2000
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    const content = data.choices[0]?.message?.content || '';
                    // Try to parse JSON from response
                    const jsonMatch = content.match(/\[[\s\S]*\]/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        questions = parsed.map((q: any, idx: number) => ({
                            id: idx + 1,
                            question: q.question || '',
                            options: q.options || ['', '', '', ''],
                            correctAnswer: q.correctAnswer || 0
                        }));
                    }
                }
            } catch (error) {
                console.error('OpenAI API error:', error);
            }
        }

        // Fallback to Anthropic if OpenAI failed or not available
        if (questions.length === 0 && ANTHROPIC_API_KEY) {
            try {
                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': ANTHROPIC_API_KEY,
                        'anthropic-version': '2023-06-01'
                    },
                    body: JSON.stringify({
                        model: 'claude-3-5-sonnet-20241022',
                        max_tokens: 2000,
                        messages: [
                            {
                                role: 'user',
                                content: `Generate multiple choice test questions based on: ${aiPrompt}. Return JSON array format: [{"question": "text", "options": ["opt1", "opt2", "opt3", "opt4"], "correctAnswer": 0}]`
                            }
                        ]
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    const content = data.content[0]?.text || '';
                    const jsonMatch = content.match(/\[[\s\S]*\]/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        questions = parsed.map((q: any, idx: number) => ({
                            id: idx + 1,
                            question: q.question || '',
                            options: q.options || ['', '', '', ''],
                            correctAnswer: q.correctAnswer || 0
                        }));
                    }
                }
            } catch (error) {
                console.error('Anthropic API error:', error);
            }
        }

        // If still no questions, return mock
        if (questions.length === 0) {
            questions = [
                { id: 1, question: "AI-Generated Q1: What is the derivative of x^2?", options: ["x", "2x", "2", "x/2"], correctAnswer: 1 },
                { id: 2, question: "AI-Generated Q2: Solve ∫(1/x) dx.", options: ["e^x", "x^2", "ln|x|", "1"], correctAnswer: 2 },
            ];
        }

        res.status(200).json({ 
            message: "AI generation complete. Review questions below.", 
            questions: questions 
        });
    } catch (error) {
        console.error('AI generation error:', error);
        res.status(500).json({ message: 'Failed to generate questions. Please try again.' });
    }
});

// Fetches results for a specific test (used by TestResults.tsx)
app.get('/api/examiner/results/:testId', (req: Request, res: Response) => {
    const { testId } = req.params;
    
    res.status(200).json({ 
        testId,
        testName: MOCK_DB.tests.find(t => t.id === parseInt(testId))?.name || "Unknown Test",
        students: MOCK_DB.results 
    });
});

// Fetches detailed student report (used by StudentReport.tsx)
app.get('/api/examiner/report/:studentId/:testId', (req: Request, res: Response) => {
    const studentIdNum = parseInt(req.params.studentId);
    
    const student = MOCK_DB.results.find(s => s.id === studentIdNum);
    
    if (!student) {
        return res.status(404).json({ message: 'Student result not found' });
    }

    const studentViolations = MOCK_DB.violations.filter(v => v.studentId === studentIdNum);

    const report = {
        student: {
            name: student.name,
            email: student.email,
            actualScore: student.actualScore,
            trustScore: student.trustScore,
        },
        violations: studentViolations.map(v => ({
            time: v.time,
            type: v.type,
            severity: v.severity,
            // Mock image data. In production, this would be a real image URL/data.
            image: "/public/placeholder.svg" 
        })),
        testSummary: {
            duration: "58:34",
            questionsAnswered: "25/25"
        }
    };

    res.status(200).json(report);
});

// ===============================
//         STUDENT ROUTES
// ===============================

// Get enrolled tests for a student
app.get('/api/student/tests', async (req: Request, res: Response) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        message: 'Database connection not available. Please try again later.',
        error: 'DATABASE_UNAVAILABLE'
      });
    }

    let { studentId, email } = req.query as { studentId?: string; email?: string };

    if (!studentId && !email) {
      return res.status(400).json({ 
        message: 'Student ID or email is required',
        error: 'MISSING_STUDENT_IDENTIFIER'
      });
    }

    // If we have studentId but no email, try to find the user to pull their email
    if (studentId && !email) {
      const user = await User.findById(studentId);
      if (user?.email) {
        email = user.email;
      }
    }

    const normalizedEmail = email?.toLowerCase().trim();

    // Build query: tests where student is allowed via email/ID or tests open to everyone
    const statusFilter = { $in: ['scheduled', 'active', 'running'] as const };
    const query: any = { status: statusFilter };
    const accessConditions: any[] = [];
    if (studentId) {
      accessConditions.push({ allowedStudents: studentId });
    }
    if (normalizedEmail) {
      accessConditions.push({ allowedStudents: normalizedEmail });
    }
    // include open tests (no restrictions)
    accessConditions.push({ allowedStudents: { $exists: false } });
    accessConditions.push({ allowedStudents: { $size: 0 } });

    query.$or = accessConditions;

    const tests = await Test.find(query).sort({ startTime: 1 });
    const now = new Date();
    const attempts = await ExamAttempt.find({
      testId: { $in: tests.map((t) => t._id) },
      studentId,
      status: 'submitted',
    }).select('testId status');

    const attemptStatusMap = new Map<string, string>();
    attempts.forEach((attempt) => {
      attemptStatusMap.set((attempt.testId as any).toString(), attempt.status);
    });

    res.status(200).json({
      tests: tests.map(test => ({
        id: (test._id as any).toString(),
        name: test.name,
        description: test.description,
        duration: test.duration,
        status: attemptStatusMap.get((test._id as any).toString()) === 'submitted'
          ? 'submitted'
          : now < test.startTime
            ? 'scheduled'
            : now > test.endTime
              ? 'completed'
              : 'active',
        questionCount: test.questionIds?.length || 0,
        startTime: test.startTime,
        endTime: test.endTime,
      }))
    });
  } catch (error: any) {
    console.error('Get student tests error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch tests. Please try again.',
      error: 'INTERNAL_ERROR'
    });
  }
});

// Get a specific test by ID
app.get('/api/student/test/:testId', async (req: Request, res: Response) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        message: 'Database connection not available. Please try again later.',
        error: 'DATABASE_UNAVAILABLE'
      });
    }

    const { testId } = req.params;
    let { studentId, email } = req.query as { studentId?: string; email?: string };

    if (!studentId && !email) {
      return res.status(400).json({ 
        message: 'Student ID or email is required',
        error: 'MISSING_STUDENT_IDENTIFIER'
      });
    }

    if (studentId && !email) {
      const user = await User.findById(studentId);
      if (user?.email) {
        email = user.email;
      }
    }
    
    const orConditions: any[] = [];
    if (studentId) {
      orConditions.push({ allowedStudents: studentId });
    }
    if (email) {
      orConditions.push({ allowedStudents: email.toLowerCase().trim() });
    }
    orConditions.push({ allowedStudents: { $exists: false } });
    orConditions.push({ allowedStudents: { $size: 0 } });

    const test = await Test.findOne({
      _id: testId,
      ...(orConditions.length > 0 ? { $or: orConditions } : {}),
    });

    if (!test) {
      return res.status(404).json({ 
        message: 'Test not found or you are not enrolled in this test',
        error: 'TEST_NOT_FOUND'
      });
    }

    const now = new Date();
    if (now < test.startTime) {
      return res.status(403).json({
        message: 'This test is not yet available.',
        error: 'TEST_NOT_STARTED',
      });
    }

    if (now > test.endTime) {
      return res.status(403).json({
        message: 'This test is no longer active.',
        error: 'TEST_ENDED',
      });
    }

    if (studentId) {
      const existingAttempt = await ExamAttempt.findOne({
        testId,
        studentId,
        status: 'submitted',
      });
      if (existingAttempt) {
        return res.status(403).json({
          message: 'You have already submitted this test.',
          error: 'TEST_ALREADY_SUBMITTED',
        });
      }
    }

    const questionIds = test.questionIds || [];
    if (!questionIds.length) {
      return res.status(400).json({
        message: 'No questions configured for this test.',
        error: 'QUESTIONS_MISSING',
      });
    }

    const questionDocs = await Question.find({ _id: { $in: questionIds } });
    const questionMap = new Map(
      questionDocs.map((doc) => [(doc._id as any).toString(), doc])
    );

    const orderedQuestions = questionIds
      .map((id, index) => {
        const doc = questionMap.get((id as any).toString());
        if (!doc) return null;
        return {
          id: index + 1,
          questionId: (doc._id as any).toString(),
          type: doc.type,
          question: doc.questionText,
          options: doc.type === 'mcq' ? doc.options : [],
          marks: doc.marks || 1,
          sampleInput: doc.sampleInput,
          sampleOutput: doc.sampleOutput,
          constraints: doc.constraints,
          codingStarterCode: doc.codingStarterCode,
          codingFunctionSignature: doc.codingFunctionSignature,
          codingTestCases: doc.codingTestCases,
          subjectiveRubric: doc.subjectiveRubric,
        };
      })
      .filter(Boolean);

    // Return test without correct answers
    res.status(200).json({
      id: (test._id as any).toString(),
      name: test.name,
      description: test.description,
      duration: test.duration,
      status: test.status,
      startTime: test.startTime,
      endTime: test.endTime,
      questions: orderedQuestions,
    });
  } catch (error: any) {
    console.error('Get test error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch test. Please try again.',
      error: 'INTERNAL_ERROR'
    });
  }
});

// Helper to normalize ML violation type to ProctoringLog label
function mapViolationTypeToLabel(type: string): 'Phone Detected' | 'Multiple Faces' | 'No Person Visible' | 'Audio Detected' | 'Looking Away' {
  const lower = type.toLowerCase();
  if (lower.includes('phone')) return 'Phone Detected';
  if (lower.includes('device')) return 'Phone Detected';
  if (lower.includes('multiple') && lower.includes('face')) return 'Multiple Faces';
  if (lower.includes('no face') || lower.includes('no person')) return 'No Person Visible';
  if (lower.includes('audio')) return 'Audio Detected';
  return 'Looking Away';
}

// Endpoint to receive 10-second video chunks for real-time proctoring
app.post('/api/student/proctor-chunk', async (req: Request, res: Response) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: 'Database connection not available. Please try again later.',
        error: 'DATABASE_UNAVAILABLE',
      });
    }

    const { studentId, testId, videoChunk, timestamp } = req.body;

    // Validate required fields
    if (!studentId || !testId || !videoChunk) {
      return res.status(400).json({
        message: 'Missing required fields: studentId, testId, videoChunk',
        error: 'MISSING_FIELDS',
      });
    }

    // Convert base64 video chunk to buffer
    const videoBase64Data = videoChunk.includes(',')
      ? videoChunk.split(',')[1]
      : videoChunk.replace(/^data:video\/\w+;base64,/, '');

    const videoBuffer = Buffer.from(videoBase64Data, 'base64');

    console.log(`[PROCTOR] Processing chunk from student ${studentId} for test ${testId}`);

    // Extract frame from video for ML processing
    const frameImage = await extractFrameFromVideo(videoBuffer);

    // Process video chunk with ML model
    const mlResult = await processVideoChunkWithML(videoBuffer);

    // If violation detected, log it to database using new ProctoringLog + ExamAttempt + GridFS
    if (mlResult.hasViolation && mlResult.violationType) {
      console.log(`[PROCTOR] Violation detected: ${mlResult.violationType} (${mlResult.severity})`);
      
      // Ensure an exam attempt exists for this student & test
      let attempt = await ExamAttempt.findOne({ testId, studentId });
      if (!attempt) {
        attempt = new ExamAttempt({
          testId,
          studentId,
          status: 'in-progress',
          startedAt: timestamp ? new Date(timestamp) : new Date(),
          totalScore: 0,
          trustScore: 100,
          totalViolations: 0,
          questionsAttempted: 0,
          answers: [],
        });
        await attempt.save();
        console.log(`[PROCTOR] Created new exam attempt for student ${studentId}`);
      }

      const logTimestamp = timestamp ? new Date(timestamp) : new Date();

      // Save frame as GridFS file if available
      let imageId: mongoose.Types.ObjectId | undefined;
      try {
        if (frameImage) {
          const bucket = getCheatingImagesBucket();
          const base64Data = frameImage.includes(',')
            ? frameImage.split(',')[1]
            : frameImage.replace(/^data:image\/\w+;base64,/, '');
          const imageBuffer = Buffer.from(base64Data, 'base64');

          await new Promise<void>((resolve, reject) => {
            const uploadStream = bucket.openUploadStream(`violation_${Date.now()}.jpg`, {
              metadata: {
                attemptId: attempt!._id,
                timestamp: logTimestamp,
                label: mlResult.violationType,
                severity: mlResult.severity || 'medium',
              },
            });
            uploadStream.on('error', reject);
            uploadStream.on('finish', () => {
              imageId = uploadStream.id as mongoose.Types.ObjectId;
              resolve();
            });
            uploadStream.end(imageBuffer);
          });
          console.log(`[PROCTOR] Saved violation image to GridFS`);
        }
      } catch (gridfsError) {
        console.error('[PROCTOR] Error saving proctoring image to GridFS:', gridfsError);
      }

      const label = mapViolationTypeToLabel(mlResult.violationType);
      const severity = mlResult.severity || 'medium';

      // Create proctoring log document
      const log = new ProctoringLog({
        attemptId: attempt._id,
        timestamp: logTimestamp,
        label,
        severity,
        imageId,
      });

      await log.save();
      console.log(`[PROCTOR] ✓ Logged violation: ${label} (${severity})`);

      // Update trust score and violation count on the attempt
      const penalty = severity === 'high' ? 10 : severity === 'medium' ? 5 : 2;
      attempt.totalViolations += 1;
      attempt.trustScore = Math.max(0, attempt.trustScore - penalty);
      await attempt.save();

      console.log(`⚠ Violation detected for student ${studentId}: ${mlResult.violationType} (${severity})`);

      // Return violation info (but don't block the test)
      res.status(200).json({
        message: 'Chunk processed successfully',
        violationDetected: true,
        violationType: mlResult.violationType,
        severity,
      });
    } else {
      // No violation, chunk processed and discarded
      console.log(`[PROCTOR] No violation in chunk from student ${studentId}`);
      res.status(200).json({
        message: 'Chunk processed successfully',
        violationDetected: false,
      });
    }
  } catch (error: any) {
    console.error('[PROCTOR] Error processing proctor chunk:', error.message);

    // Don't fail the request - just log the error
    // The test should continue even if chunk processing fails
    res.status(200).json({
      message: 'Chunk received (processing error logged)',
      violationDetected: false,
    });
  }
});

// Used by StudentTest.tsx to submit answers and save recording
app.post('/api/student/submit-test', async (req: Request, res: Response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: 'Database connection not available. Please try again later.',
        error: 'DATABASE_UNAVAILABLE',
      });
    }

    const { studentId, testId, answers, startTime, endTime, violations } = req.body;

    if (!studentId || !testId || !startTime || !endTime) {
      return res.status(400).json({
        message: 'Missing required fields: studentId, testId, startTime, endTime',
        error: 'MISSING_FIELDS',
      });
    }

    const existingSubmission = await ExamAttempt.findOne({
      testId,
      studentId,
      status: 'submitted',
    });

    if (existingSubmission) {
      return res.status(409).json({
        message: 'You have already submitted this test.',
        error: 'TEST_ALREADY_SUBMITTED',
      });
    }

    const duration = Math.floor(
      (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000
    );

    // Fetch test to evaluate answers against embedded questions
    const test = await Test.findById(testId);

    let actualScore = 0;
    let questionsAttempted = 0;
    const examAnswers: {
      questionId: mongoose.Types.ObjectId;
      answer: any;
      isCorrect: boolean;
      marksObtained: number;
    }[] = [];

    let evaluationQuestions: {
      index: number;
      questionId?: mongoose.Types.ObjectId;
      type?: string;
      correctAnswer?: number;
      marks?: number;
    }[] = [];

    if (test?.questionIds?.length) {
      // Only fetch necessary fields for evaluation (optimization: select specific fields)
      const questionDocs = await Question.find(
        { _id: { $in: test.questionIds } },
        { type: 1, correctAnswer: 1, marks: 1 }
      ).lean(); // Use lean() for read-only data (faster queries)
      
      const questionMap = new Map(
        questionDocs.map((doc) => [(doc._id as any).toString(), doc])
      );
      evaluationQuestions = test.questionIds
        .map((id, index) => {
          const doc = questionMap.get((id as any).toString());
          if (!doc) return null;
          return {
            index: index + 1,
            questionId: id as mongoose.Types.ObjectId,
            type: doc.type,
            correctAnswer:
              doc.type === 'mcq' && typeof doc.correctAnswer === 'number'
                ? doc.correctAnswer
                : undefined,
            marks: doc.marks || 1,
          };
        })
        .filter(Boolean) as any[];
    }

    for (const q of evaluationQuestions) {
      const givenAnswer = answers ? (answers as any)[q.index] : undefined;
      if (givenAnswer !== undefined && givenAnswer !== null) {
        questionsAttempted += 1;
        let isCorrect = false;
        let marksAwarded = 0;

        if (q.type === 'mcq' && typeof q.correctAnswer === 'number') {
          isCorrect = givenAnswer === q.correctAnswer;
          marksAwarded = isCorrect ? (q.marks || 1) : 0;
        }

        actualScore += marksAwarded;

        if (q.questionId) {
          examAnswers.push({
            questionId: q.questionId,
            answer: givenAnswer,
            isCorrect,
            marksObtained: marksAwarded,
          });
        }
      }
    }

    // Ensure ExamAttempt exists and update it
    let attempt = await ExamAttempt.findOne({ testId, studentId });
    if (!attempt) {
      attempt = new ExamAttempt({
        testId,
        studentId,
        status: 'submitted',
        startedAt: new Date(startTime),
        endedAt: new Date(endTime),
        duration,
        answers: examAnswers,
        totalScore: actualScore,
        trustScore: 100,
        totalViolations: violations?.length || 0,
        questionsAttempted,
      });
    } else {
      attempt.status = 'submitted';
      attempt.endedAt = new Date(endTime);
      attempt.duration = duration;
      attempt.answers = examAnswers;
      attempt.totalScore = actualScore;
      attempt.questionsAttempted = questionsAttempted;
      // Keep trustScore as is if it was already reduced by proctoring; otherwise compute simple heuristic
      if (attempt.trustScore === undefined || attempt.trustScore === null) {
        const violationCount = violations?.length || attempt.totalViolations || 0;
        attempt.trustScore = Math.max(0, 100 - violationCount * 5);
      }
    }

    const violationCount = violations?.length || attempt.totalViolations || 0;
    if (!attempt.totalViolations) {
      attempt.totalViolations = violationCount;
    }

    await attempt.save();

    // Log all violations received during submission to ProctoringLog
    if (violations && Array.isArray(violations) && violations.length > 0) {
      try {
        for (const violation of violations) {
          const label = mapViolationTypeToLabel(violation.type || '');
          const log = new ProctoringLog({
            attemptId: attempt._id,
            timestamp: violation.timestamp ? new Date(violation.timestamp) : new Date(),
            label,
            severity: violation.severity || 'medium',
          });
          await log.save();
        }
        console.log(`✓ Logged ${violations.length} violations for student ${studentId} on test ${testId}`);
      } catch (logError) {
        console.error('Error logging violations during submission:', logError);
        // Don't fail the submission due to logging errors
      }
    }

    const trustScore = attempt.trustScore;

    res.status(200).json({
      message: 'Test submitted successfully.',
      actualScore,
      trustScore,
      violationCount,
    });
  } catch (error: any) {
    console.error('Test submission error:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Validation failed',
        error: 'VALIDATION_ERROR',
      });
    }

    res.status(500).json({
      message: 'Failed to submit test. Please try again.',
      error: 'INTERNAL_ERROR',
    });
  }
});


// --- MongoDB Connection and Server Start ---
async function startServer() {
  // Load face recognition models asynchronously (non-blocking)
  // Models will be loaded when homepage is accessed or when needed
  loadFaceModels().catch((error: any) => {
    console.error('⚠ Face recognition models not loaded:', error.message);
    console.error('⚠ Face verification will not work. Please download models from:');
    console.error('⚠ https://github.com/justadudewhohacks/face-api.js-models');
    console.error('⚠ Place them in: server/models/ directory');
  });

  // Connect to MongoDB if URI is provided
  if (MONGODB_URI) {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log('✓ MongoDB connected successfully');
    } catch (err: any) {
      console.error('✗ MongoDB connection error:', err);
      console.error('⚠ Server will continue but authentication will fail. Please check your MONGODB_URI in .env file.');
    }
  } else {
    console.log('⚠ MongoDB URI not configured. Please set MONGODB_URI in your .env file.');
    console.log('⚠ Authentication features will not work without MongoDB connection.');
  }

  // Start the server
  app.listen(PORT, () => {
    console.log(`\nPariksha AI Backend server is running on port ${PORT}`);
    console.log(`CORS enabled for origin: ${CORS_ORIGIN || 'Not set (check CORS_ORIGIN in .env)'}`);
    if (MONGODB_URI) {
      console.log('✓ MongoDB URI configured');
    } else {
      console.log('⚠ MongoDB URI not configured. Authentication will not work.');
    }
    if (OPENAI_API_KEY) {
      console.log('✓ OpenAI API key configured');
    }
    if (ANTHROPIC_API_KEY) {
      console.log('✓ Anthropic API key configured');
    }
    if (!OPENAI_API_KEY && !ANTHROPIC_API_KEY) {
      console.log('⚠ No AI API keys configured. AI generation will use mock mode.');
    }
  });
}

// Start the server
startServer();
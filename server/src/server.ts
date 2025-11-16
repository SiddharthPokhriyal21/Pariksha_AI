// server/src/server.ts
import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User';
import Test from './models/Test';
import TestRecording from './models/TestRecording';
import Violation from './models/Violation';
import { loadFaceModels, validateFace, compareFaces } from './utils/faceRecognition';
import { processVideoChunkWithML, extractFrameFromVideo } from './utils/mlProctoring';

// Load environment variables from .env file
dotenv.config();

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
  tests: [
    { id: 1, name: "Mathematics Final Exam", questions: [], status: "scheduled", date: "2024-12-20", studentsEnrolled: 45 },
    { id: 2, name: "Physics Midterm", questions: [], status: "completed", date: "2024-12-18", studentsEnrolled: 38 },
    { id: 3, name: "Chemistry Quiz", questions: [], status: "scheduled", date: "2024-12-22", studentsEnrolled: 50 },
  ] as Test[],
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

// Fetches data for ExaminerDashboard.tsx
app.get('/api/examiner/dashboard', async (req: Request, res: Response) => {
  try {
    const totalTests = MOCK_DB.tests.length;
    const completedTests = MOCK_DB.tests.filter(t => t.status === 'completed').length;
    const scheduledTests = totalTests - completedTests;
    // Count students from MongoDB
    const studentCount = await User.countDocuments({ role: 'student' });
    const activeStudents = studentCount + MOCK_DB.results.length;

    const dashboardData = {
      stats: [
        { label: "Total Tests", value: totalTests.toString(), color: "primary" },
        { label: "Active Students", value: activeStudents.toString(), color: "secondary" },
        { label: "Completed", value: completedTests.toString(), color: "success" },
        { label: "Scheduled", value: scheduledTests.toString(), color: "warning" },
      ],
      tests: MOCK_DB.tests.map(t => ({ 
        id: t.id, 
        name: t.name, 
        date: t.date, 
        students: t.studentsEnrolled, 
        status: t.status 
      })).reverse(),
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
        error: 'DATABASE_UNAVAILABLE'
      });
    }

    const { testName, description, questions, scheduledDate, duration, enrolledStudents, examinerId } = req.body;
    
    if (!testName || !questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ 
        message: 'Test name and questions are required.',
        error: 'MISSING_FIELDS'
      });
    }

    // Get examiner ID from request (you may need to add authentication middleware)
    const examiner = examinerId || 'unknown'; // TODO: Get from auth token

    // Create test in MongoDB
    const newTest = new Test({
      name: testName,
      description: description || '',
      examinerId: examiner,
      questions: questions.map((q: any, index: number) => ({
        id: index + 1,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer
      })),
      status: 'scheduled',
      scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(),
      duration: duration || 60, // Default 60 minutes
      enrolledStudents: enrolledStudents || [] // Array of student IDs
    });

    await newTest.save();

    // Also add to MOCK_DB for backward compatibility (if needed)
    const mockTest: Test = {
      id: getNextId(MOCK_DB.tests),
      name: testName,
      questions: questions,
      status: 'scheduled',
      date: new Date().toISOString().split('T')[0], // Today's date
      studentsEnrolled: enrolledStudents?.length || 0,
    };
    MOCK_DB.tests.push(mockTest);

    res.status(201).json({ 
      message: 'Test created successfully', 
      testId: (newTest._id as any).toString(),
      mongoTestId: (newTest._id as any).toString()
    });
  } catch (error: any) {
    console.error('Create test error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation failed',
        error: 'VALIDATION_ERROR'
      });
    }
    
    res.status(500).json({ 
      message: 'Failed to create test. Please try again.',
      error: 'INTERNAL_ERROR'
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

    const { studentId } = req.query;

    if (!studentId) {
      return res.status(400).json({ 
        message: 'Student ID is required',
        error: 'MISSING_STUDENT_ID'
      });
    }

    // Find tests where student is enrolled and status is scheduled or active
    const tests = await Test.find({
      enrolledStudents: studentId,
      status: { $in: ['scheduled', 'active'] }
    }).sort({ scheduledDate: 1 });

    res.status(200).json({
      tests: tests.map(test => ({
        id: (test._id as any).toString(),
        name: test.name,
        description: test.description,
        scheduledDate: test.scheduledDate,
        duration: test.duration,
        status: test.status,
        questionCount: test.questions.length
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
    const { studentId } = req.query;

    if (!studentId) {
      return res.status(400).json({ 
        message: 'Student ID is required',
        error: 'MISSING_STUDENT_ID'
      });
    }

    const test = await Test.findOne({
      _id: testId,
      enrolledStudents: studentId
    });

    if (!test) {
      return res.status(404).json({ 
        message: 'Test not found or you are not enrolled in this test',
        error: 'TEST_NOT_FOUND'
      });
    }

    // Return test without correct answers
    res.status(200).json({
      id: (test._id as any).toString(),
      name: test.name,
      description: test.description,
      scheduledDate: test.scheduledDate,
      duration: test.duration,
      status: test.status,
      questions: test.questions.map(q => ({
        id: q.id,
        question: q.question,
        options: q.options
        // Don't send correctAnswer to student
      }))
    });
  } catch (error: any) {
    console.error('Get test error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch test. Please try again.',
      error: 'INTERNAL_ERROR'
    });
  }
});

// Endpoint to receive 10-second video chunks for real-time proctoring
app.post('/api/student/proctor-chunk', async (req: Request, res: Response) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        message: 'Database connection not available. Please try again later.',
        error: 'DATABASE_UNAVAILABLE'
      });
    }

    const { studentId, testId, videoChunk, timestamp } = req.body;
    
    // Validate required fields
    if (!studentId || !testId || !videoChunk) {
      return res.status(400).json({ 
        message: 'Missing required fields: studentId, testId, videoChunk',
        error: 'MISSING_FIELDS'
      });
    }

    // Convert base64 video chunk to buffer
    const videoBase64Data = videoChunk.includes(',') 
      ? videoChunk.split(',')[1] 
      : videoChunk.replace(/^data:video\/\w+;base64,/, '');
    
    const videoBuffer = Buffer.from(videoBase64Data, 'base64');

    // Extract frame from video for ML processing
    const frameImage = await extractFrameFromVideo(videoBuffer);

    // Process video chunk with ML model
    const mlResult = await processVideoChunkWithML(videoBuffer, frameImage);

    // If violation detected, log it to database
    if (mlResult.hasViolation && mlResult.violationType) {
      const violation = new Violation({
        studentId,
        testId,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        type: mlResult.violationType,
        severity: mlResult.severity || 'medium',
        image: frameImage, // Store the frame image with the violation
        confidence: mlResult.confidence,
        description: mlResult.description,
      });

      await violation.save();
      
      console.log(`⚠ Violation detected for student ${studentId}: ${mlResult.violationType} (${mlResult.severity})`);
      
      // Return violation info (but don't block the test)
      res.status(200).json({ 
        message: 'Chunk processed successfully',
        violationDetected: true,
        violationType: mlResult.violationType,
        severity: mlResult.severity,
      });
    } else {
      // No violation, chunk processed and discarded
      res.status(200).json({ 
        message: 'Chunk processed successfully',
        violationDetected: false,
      });
    }
  } catch (error: any) {
    console.error('Error processing proctor chunk:', error);
    
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
        // Check MongoDB connection
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ 
                message: 'Database connection not available. Please try again later.',
                error: 'DATABASE_UNAVAILABLE'
            });
        }

        const { studentId, testId, answers, videoBlob, audioBlob, startTime, endTime, violations } = req.body;
        
        // Validate required fields
        if (!studentId || !testId || !videoBlob || !audioBlob || !startTime || !endTime) {
            return res.status(400).json({ 
                message: 'Missing required fields: studentId, testId, videoBlob, audioBlob, startTime, endTime',
                error: 'MISSING_FIELDS'
            });
        }

        // Calculate duration
        const duration = Math.floor((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000);

        // Convert base64 blobs to buffers (handle data URL format)
        const videoBase64Data = videoBlob.includes(',') 
          ? videoBlob.split(',')[1] 
          : videoBlob.replace(/^data:video\/\w+;base64,/, '');
        const audioBase64Data = audioBlob.includes(',') 
          ? audioBlob.split(',')[1] 
          : audioBlob.replace(/^data:audio\/\w+;base64,/, '');
        
        const videoBuffer = Buffer.from(videoBase64Data, 'base64');
        const audioBuffer = Buffer.from(audioBase64Data, 'base64');

        // Create test recording document
        const recording = new TestRecording({
            studentId,
            testId,
            videoBlob: videoBuffer,
            audioBlob: audioBuffer,
            videoMimeType: 'video/webm',
            audioMimeType: 'audio/webm',
            duration,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            answers: answers || {},
            violations: violations || [],
        });

        await recording.save();

        // Calculate mock scores (in production, calculate based on answers)
        const actualScore = Math.floor(Math.random() * 100);
        const violationCount = violations?.length || 0;
        const trustScore = Math.max(0, 100 - (violationCount * 5));

        res.status(200).json({ 
            message: 'Test submitted successfully.', 
            recordingId: (recording._id as any).toString(),
            actualScore,
            trustScore,
            violationCount
        });
    } catch (error: any) {
        console.error('Test submission error:', error);
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({ 
                message: 'Validation failed',
                error: 'VALIDATION_ERROR'
            });
        }
        
        res.status(500).json({ 
            message: 'Failed to submit test. Please try again.',
            error: 'INTERNAL_ERROR'
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
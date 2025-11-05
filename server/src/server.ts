// server/src/server.ts
import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';

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
// Parses JSON bodies, increasing limit to handle base64 photos
app.use(bodyParser.json({ limit: '50mb' })); 

// --- Utility Functions ---
const findUser = (email: string, role: 'student' | 'examiner') => 
  MOCK_DB.users.find(u => u.email === email && u.role === role);

const getNextId = (arr: any[]) => (arr.length ? Math.max(...arr.map(i => i.id)) + 1 : 1);


// ===============================
//         AUTH ROUTES
// ===============================

// Handles registration from StudentRegister.tsx and ExaminerRegister.tsx
app.post('/api/auth/:role/register', (req: Request, res: Response) => {
  const { role } = req.params;
  const { fullName, email, password, photo } = req.body;

  if (!fullName || !email || !password || !photo) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  if (findUser(email, role as 'student' | 'examiner')) {
    return res.status(409).json({ message: `User with email ${email} already exists.` });
  }

  const newUser = {
    id: getNextId(MOCK_DB.users),
    fullName,
    email,
    password,
    role: role as 'student' | 'examiner',
    photo,
  };
  MOCK_DB.users.push(newUser);

  // Success. In a real app, 'password' would be hashed.
  res.status(201).json({ message: 'Registration successful', userId: newUser.id, role: newUser.role });
});

// Handles login from StudentLogin.tsx and ExaminerLogin.tsx
app.post('/api/auth/:role/login', (req: Request, res: Response) => {
  const { role } = req.params;
  const { email, password, photo } = req.body; // 'photo' is for face verification

  const user = findUser(email, role as 'student' | 'examiner');

  // Simplified login logic: check email/password/role. Mock face verification passes if user exists.
  if (!user || user.password !== password) {
    return res.status(401).json({ message: 'Invalid credentials or face verification failed.' });
  }

  // Success. In a real app, a token would be returned.
  res.status(200).json({ message: 'Authentication Successful!', user: { id: user.id, name: user.fullName, role: user.role } });
});


// ===============================
//         EXAMINER ROUTES
// ===============================

// Fetches data for ExaminerDashboard.tsx
app.get('/api/examiner/dashboard', (req: Request, res: Response) => {
  const totalTests = MOCK_DB.tests.length;
  const completedTests = MOCK_DB.tests.filter(t => t.status === 'completed').length;
  const scheduledTests = totalTests - completedTests;
  const activeStudents = MOCK_DB.users.filter(u => u.role === 'student').length + MOCK_DB.results.length;

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
});

// Used by CreateTest.tsx to save a new test
app.post('/api/examiner/tests', (req: Request, res: Response) => {
  const { testName, questions } = req.body;
  
  const newTest: Test = {
    id: getNextId(MOCK_DB.tests),
    name: testName,
    questions: questions,
    status: 'scheduled',
    date: new Date().toISOString().split('T')[0], // Today's date
    studentsEnrolled: 10, // Mock value
  };
  MOCK_DB.tests.push(newTest);

  res.status(201).json({ message: 'Test created successfully', testId: newTest.id });
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

// Used by StudentTest.tsx to submit answers and mock scoring
app.post('/api/student/submit-test', (req: Request, res: Response) => {
    const { userId, testId, answers } = req.body;
    
    // In a real app, this would perform scoring and save data.
    res.status(200).json({ 
        message: 'Test submitted successfully.', 
        // Mock score and trust data
        actualScore: Math.floor(Math.random() * 100), 
        trustScore: Math.floor(Math.random() * 100)
    });
});


// --- Database Connection (for future MongoDB integration) ---
// TODO: Implement MongoDB connection when ready
// if (MONGODB_URI) {
//   mongoose.connect(MONGODB_URI)
//     .then(() => console.log('✓ MongoDB connected'))
//     .catch((err) => console.error('MongoDB connection error:', err));
// } else {
//   console.log('⚠ MongoDB URI not configured. Using in-memory database.');
// }

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`\nPariksha AI Backend server is running on port ${PORT}`);
  console.log(`CORS enabled for origin: ${CORS_ORIGIN || 'Not set (check CORS_ORIGIN in .env)'}`);
  if (MONGODB_URI) {
    console.log('✓ MongoDB URI configured');
  } else {
    console.log('⚠ MongoDB URI not configured. Using in-memory database.');
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
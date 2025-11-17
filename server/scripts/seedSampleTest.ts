import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Question, { IQuestion } from '../src/models/Question';
import Test from '../src/models/Test';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const TARGET_EMAIL = 'sanchitnegi177@gmail.com';
const SAMPLE_TEST_NAME = 'AI Fundamentals Practice Test';

type SampleQuestionSeed = {
  type: 'mcq';
  questionText: string;
  options: string[];
  correctAnswerIndex: number;
  marks: number;
};

const sampleQuestions: SampleQuestionSeed[] = [
  {
    type: 'mcq',
    questionText: 'Which component acts as the brain of a computer and performs most of the processing?',
    options: ['RAM', 'CPU', 'GPU', 'SSD'],
    correctAnswerIndex: 1,
    marks: 2,
  },
  {
    type: 'mcq',
    questionText: 'What does the term “training data” refer to in machine learning?',
    options: [
      'Data used only for evaluating model accuracy',
      'Synthetic data generated after deployment',
      'Annotated examples used to teach a model patterns',
      'Unstructured data collected from sensors',
    ],
    correctAnswerIndex: 2,
    marks: 3,
  },
  {
    type: 'mcq',
    questionText: 'Which algorithm is typically used for finding the shortest path in a weighted graph with non-negative edges?',
    options: ['Depth-First Search', 'Breadth-First Search', 'Merge Sort', "Dijkstra's Algorithm"],
    correctAnswerIndex: 3,
    marks: 3,
  },
  {
    type: 'mcq',
    questionText: 'In supervised learning, what is the role of the loss function?',
    options: [
      'To initialize neural network weights randomly',
      'To measure the error between predictions and actual values',
      'To generate new training data automatically',
      'To choose the activation function for each layer',
    ],
    correctAnswerIndex: 1,
    marks: 2,
  },
  {
    type: 'mcq',
    questionText: 'Which evaluation metric is best suited for imbalanced binary classification problems?',
    options: ['Accuracy', 'Precision-Recall AUC', 'Mean Squared Error', 'R-squared'],
    correctAnswerIndex: 1,
    marks: 2,
  },
];

async function ensureQuestions(): Promise<IQuestion[]> {
  const createdQuestions: IQuestion[] = [];

  for (const question of sampleQuestions) {
    let doc = await Question.findOne({ questionText: question.questionText });
    if (!doc) {
      doc = await Question.create({
        type: question.type,
        questionText: question.questionText,
        options: question.options,
        correctAnswer: question.correctAnswerIndex,
        marks: question.marks,
      });
      console.log(`Created question: "${doc.questionText}"`);
    } else {
      const needsUpdate =
        doc.correctAnswer !== question.correctAnswerIndex ||
        doc.marks !== question.marks ||
        (doc.options || []).join('|') !== question.options.join('|');

      if (needsUpdate) {
        doc.type = question.type;
        doc.options = question.options;
        doc.correctAnswer = question.correctAnswerIndex;
        doc.marks = question.marks;
        await doc.save();
        console.log(`Updated question: "${doc.questionText}"`);
      } else {
        console.log(`Reusing existing question: "${doc.questionText}"`);
      }
    }
    createdQuestions.push(doc);
  }

  return createdQuestions;
}

async function upsertTest(questionDocs: IQuestion[]) {
  const questionObjectIds = questionDocs.map(
    (doc) => doc._id as mongoose.Types.ObjectId,
  );

  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 2);
  const endDate = new Date(startDate.getTime() + 45 * 60 * 1000);

  const testPayload = {
    name: SAMPLE_TEST_NAME,
    description: 'Practice assessment covering core AI and ML fundamentals.',
    examinerId: 'seed-script',
    duration: 45,
    status: 'scheduled' as const,
    allowedStudents: [TARGET_EMAIL],
    questionIds: questionObjectIds,
    startTime: startDate,
    endTime: endDate,
  };

  const existingTest = await Test.findOne({ name: SAMPLE_TEST_NAME });

  if (existingTest) {
    existingTest.description = testPayload.description;
    existingTest.duration = testPayload.duration;
    existingTest.status = testPayload.status;
    existingTest.allowedStudents = Array.from(
      new Set([...(existingTest.allowedStudents || []), TARGET_EMAIL]),
    );
    existingTest.questionIds = questionObjectIds;
    existingTest.examinerId = testPayload.examinerId;
    existingTest.startTime = testPayload.startTime;
    existingTest.endTime = testPayload.endTime;
    await existingTest.save();
    console.log(
      `Updated existing test "${SAMPLE_TEST_NAME}" (id: ${
        (existingTest._id as mongoose.Types.ObjectId).toString()
      })`,
    );
    return;
  }

  const createdTest = await Test.create(testPayload);
  console.log(
    `Created new test "${SAMPLE_TEST_NAME}" (id: ${
      (createdTest._id as mongoose.Types.ObjectId).toString()
    })`,
  );
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Update server/.env and retry.');
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  try {
    const questionDocs = await ensureQuestions();
    await upsertTest(questionDocs);
    console.log(`Assigned test access to ${TARGET_EMAIL}`);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

main().catch((error) => {
  console.error('Seed script failed:', error);
  mongoose.disconnect();
  process.exit(1);
});


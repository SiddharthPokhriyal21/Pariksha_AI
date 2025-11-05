import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Sparkles, Plus, Trash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api-config";

interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
}

const CreateTest = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [creationMode, setCreationMode] = useState<'ai' | 'manual'>('ai');
  const [testName, setTestName] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [questions, setQuestions] = useState<Question[]>([
    { id: 1, question: '', options: ['', '', '', ''], correctAnswer: 0 }
  ]);

  const addQuestion = () => {
    setQuestions([...questions, { 
      id: questions.length + 1, 
      question: '', 
      options: ['', '', '', ''], 
      correctAnswer: 0 
    }]);
  };

  const removeQuestion = (id: number) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const handleGenerateWithAI = async () => {
    if (!aiPrompt.trim()) {
      toast({
        title: "Prompt Required",
        description: "Please describe the test you want to generate",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Generating Test",
      description: "AI is creating your test questions...",
    });
    
    try {
      const response = await fetch(getApiUrl('/api/examiner/ai-generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiPrompt })
      });

      if (response.ok) {
        const data = await response.json();
        setQuestions(data.questions.map((q: Question, idx: number) => ({
          ...q,
          id: idx + 1
        })));
        toast({
          title: "Test Generated!",
          description: data.message || "Review and edit the generated questions",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Generation Failed",
          description: error.message || "Failed to generate questions. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to AI service. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSaveTest = async () => {
    if (!testName.trim()) {
      toast({
        title: "Test Name Required",
        description: "Please enter a name for your test",
        variant: "destructive",
      });
      return;
    }

    // Validate questions
    const validQuestions = questions.filter(q => 
      q.question.trim() && q.options.every(opt => opt.trim())
    );

    if (validQuestions.length === 0) {
      toast({
        title: "Questions Required",
        description: "Please add at least one valid question",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(getApiUrl('/api/examiner/tests'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testName,
          questions: validQuestions
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Test Created!",
          description: data.message || "Your test has been saved successfully",
        });
        navigate('/examiner/dashboard');
      } else {
        const error = await response.json();
        toast({
          title: "Save Failed",
          description: error.message || "Failed to save test. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save test. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="bg-card border-b">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/examiner/dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>

      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Create New Test</CardTitle>
            <CardDescription>Generate questions with AI or create manually</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="testName">Test Name</Label>
              <Input 
                id="testName"
                placeholder="e.g., Mathematics Final Exam"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <Label>Creation Mode</Label>
              <RadioGroup value={creationMode} onValueChange={(value) => setCreationMode(value as 'ai' | 'manual')}>
                <div className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="ai" id="ai" />
                  <Label htmlFor="ai" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="font-semibold">Generate with AI</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Describe your test and let AI create questions
                    </p>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="manual" id="manual" />
                  <Label htmlFor="manual" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-secondary" />
                      <span className="font-semibold">Create Manually</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Add questions one by one yourself
                    </p>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {creationMode === 'ai' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="aiPrompt">Describe Your Test</Label>
                  <Textarea 
                    id="aiPrompt"
                    placeholder="E.g., Create 10 multiple choice questions on calculus, focusing on derivatives and integrals. Include difficulty levels from easy to hard."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    rows={5}
                  />
                </div>
                <Button onClick={handleGenerateWithAI} className="w-full">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Questions with AI
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {questions.map((q, qIndex) => (
                  <Card key={q.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Question {qIndex + 1}</CardTitle>
                        {questions.length > 1 && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => removeQuestion(q.id)}
                          >
                            <Trash className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Question Text</Label>
                        <Textarea 
                          placeholder="Enter your question"
                          value={q.question}
                          onChange={(e) => {
                            const newQuestions = [...questions];
                            newQuestions[qIndex].question = e.target.value;
                            setQuestions(newQuestions);
                          }}
                        />
                      </div>

                      <div className="space-y-3">
                        <Label>Options (Select correct answer)</Label>
                        <RadioGroup 
                          value={q.correctAnswer.toString()}
                          onValueChange={(value) => {
                            const newQuestions = [...questions];
                            newQuestions[qIndex].correctAnswer = parseInt(value);
                            setQuestions(newQuestions);
                          }}
                        >
                          {q.options.map((option, optIndex) => (
                            <div key={optIndex} className="flex items-center gap-3">
                              <RadioGroupItem value={optIndex.toString()} id={`q${q.id}-opt${optIndex}`} />
                              <Input 
                                placeholder={`Option ${optIndex + 1}`}
                                value={option}
                                onChange={(e) => {
                                  const newQuestions = [...questions];
                                  newQuestions[qIndex].options[optIndex] = e.target.value;
                                  setQuestions(newQuestions);
                                }}
                                className="flex-1"
                              />
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <Button onClick={addQuestion} variant="outline" className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Question
                </Button>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => navigate('/examiner/dashboard')} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSaveTest} className="flex-1">
                Save Test
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateTest;

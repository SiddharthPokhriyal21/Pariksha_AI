import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { AlertCircle, Camera, Clock, Eye, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const StudentTest = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [timeLeft, setTimeLeft] = useState(3600); // 60 minutes
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [proctoringAlerts, setProctoringAlerts] = useState<string[]>([]);
  
  // Mock questions
  const questions = [
    {
      id: 1,
      question: "What is the capital of France?",
      options: ["London", "Berlin", "Paris", "Madrid"]
    },
    {
      id: 2,
      question: "Which planet is known as the Red Planet?",
      options: ["Venus", "Mars", "Jupiter", "Saturn"]
    },
    // Add more questions as needed
  ];

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Mock proctoring alerts
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate random proctoring events
      const events = [
        "Multiple faces detected",
        "Looking away from screen",
        "Unauthorized device detected",
        "Audio detected"
      ];
      
      if (Math.random() > 0.7) {
        const event = events[Math.floor(Math.random() * events.length)];
        setProctoringAlerts(prev => [...prev, `${new Date().toLocaleTimeString()}: ${event}`]);
        
        toast({
          title: "Proctoring Alert",
          description: event,
          variant: "destructive",
        });
      }
    }, 15000); // Check every 15 seconds

    return () => clearInterval(interval);
  }, [toast]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmitTest = () => {
    toast({
      title: "Test Submitted",
      description: "Your exam has been submitted successfully",
    });
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-hero p-4">
      {/* Proctoring Header */}
      <div className="bg-card border-b sticky top-0 z-50 shadow-md">
        <div className="container max-w-7xl mx-auto py-3 px-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="bg-success/10">
                <Eye className="w-3 h-3 mr-1" />
                Proctoring Active
              </Badge>
              <Badge variant="outline" className="bg-primary/10">
                <Camera className="w-3 h-3 mr-1" />
                Recording
              </Badge>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-destructive font-semibold">
                <Clock className="w-5 h-5" />
                {formatTime(timeLeft)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-7xl mx-auto py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Test Area */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Question {currentQuestion + 1} of {questions.length}</CardTitle>
                  <Badge>{Math.round(((currentQuestion + 1) / questions.length) * 100)}% Complete</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-lg font-medium">
                  {questions[currentQuestion].question}
                </div>

                <RadioGroup 
                  value={answers[currentQuestion]} 
                  onValueChange={(value) => setAnswers({...answers, [currentQuestion]: value})}
                >
                  {questions[currentQuestion].options.map((option, index) => (
                    <div key={index} className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-muted/50 cursor-pointer">
                      <RadioGroupItem value={option} id={`q${currentQuestion}-${index}`} />
                      <Label htmlFor={`q${currentQuestion}-${index}`} className="flex-1 cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>

                <div className="flex gap-3 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                    disabled={currentQuestion === 0}
                  >
                    Previous
                  </Button>
                  {currentQuestion < questions.length - 1 ? (
                    <Button 
                      onClick={() => setCurrentQuestion(currentQuestion + 1)}
                      className="flex-1"
                    >
                      Next Question
                    </Button>
                  ) : (
                    <Button onClick={handleSubmitTest} className="flex-1">
                      Submit Test
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Proctoring Sidebar */}
          <div className="space-y-6">
            {/* Webcam Feed */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Live Webcam Feed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                  <Camera className="w-12 h-12 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Keep your face visible at all times
                </p>
              </CardContent>
            </Card>

            {/* Proctoring Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Proctoring Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {proctoringAlerts.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      No violations detected
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {proctoringAlerts.slice(-5).reverse().map((alert, index) => (
                      <Alert key={index} variant="destructive">
                        <AlertDescription className="text-xs">
                          {alert}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Question Navigator */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Question Navigator</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((_, index) => (
                    <Button
                      key={index}
                      variant={currentQuestion === index ? "default" : answers[index] ? "outline" : "ghost"}
                      size="sm"
                      onClick={() => setCurrentQuestion(index)}
                      className="w-full"
                    >
                      {index + 1}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentTest;

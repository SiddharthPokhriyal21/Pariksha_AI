import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Camera, Clock, Eye, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api-config";

const StudentTest = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [timeLeft, setTimeLeft] = useState(3600); // 60 minutes
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLiveFeed, setShowLiveFeed] = useState(true);
  
  // Refs for recording
  const liveFeedRef = useRef<HTMLVideoElement>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const audioChunksRef = useRef<Blob[]>([]);
  const combinedStreamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const violationsRef = useRef<Array<{ timestamp: Date; type: string; severity: 'low' | 'medium' | 'high' }>>([]);
  const chunkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
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

  // Initialize camera and recording
  useEffect(() => {
    let isMounted = true;

    const startRecording = async () => {
      try {
        // Request camera and microphone access together
        const combinedStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        if (!isMounted) {
          combinedStream.getTracks().forEach(track => track.stop());
          return;
        }

        combinedStreamRef.current = combinedStream;

        // Set up live feed (top right corner)
        if (liveFeedRef.current) {
          liveFeedRef.current.srcObject = combinedStream;
          liveFeedRef.current.play().catch(console.error);
        }

        // Get video and audio tracks separately for recording
        const videoTracks = combinedStream.getVideoTracks();
        const audioTracks = combinedStream.getAudioTracks();

        // Create video-only stream for video recording
        const videoStream = new MediaStream(videoTracks);
        const videoRecorder = new MediaRecorder(videoStream, {
          mimeType: 'video/webm;codecs=vp8'
        });

        // Store chunks temporarily for 10-second intervals (outside async function)
        let tempVideoChunks: Blob[] = [];

        videoRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            tempVideoChunks.push(event.data);
            videoChunksRef.current.push(event.data); // Keep for final submission
          }
        };

        // Create audio-only stream for audio recording
        const audioStream = new MediaStream(audioTracks);
        const audioRecorder = new MediaRecorder(audioStream, {
          mimeType: 'audio/webm;codecs=opus'
        });

        audioRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        // Function to send 10-second chunk to server
        const sendChunkToServer = async () => {
          if (tempVideoChunks.length === 0) return;

          try {
            // Combine chunks into a single blob
            const chunkBlob = new Blob(tempVideoChunks, { type: 'video/webm' });
            
            // Convert to base64
            const chunkBase64 = await blobToBase64(chunkBlob);
            
            // Get student ID and test ID
            const studentId = localStorage.getItem('studentId') || 'unknown';
            const testId = localStorage.getItem('testId') || 'unknown';

            // Send chunk to server for ML processing
            const response = await fetch(getApiUrl('/api/student/proctor-chunk'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                studentId,
                testId,
                videoChunk: chunkBase64,
                timestamp: new Date().toISOString(),
              }),
            });

            if (response.ok) {
              const data = await response.json();
              if (data.violationDetected) {
                // Log violation locally (for final submission)
                violationsRef.current.push({
                  timestamp: new Date(),
                  type: data.violationType || 'Suspicious behavior detected',
                  severity: data.severity || 'medium',
                });
              }
            }

            // Clear temp chunks after sending (discard)
            tempVideoChunks.length = 0;
          } catch (error) {
            console.error('Error sending chunk to server:', error);
            // Continue recording even if chunk send fails
          }
        };

        // Start both recorders with 10-second timeslice
        videoRecorder.start(1000); // Collect data every second
        audioRecorder.start(1000);
        
        videoRecorderRef.current = videoRecorder;
        audioRecorderRef.current = audioRecorder;

        // Send chunks every 10 seconds
        chunkIntervalRef.current = setInterval(() => {
          sendChunkToServer();
        }, 10000); // 10 seconds

        setIsRecording(true);
        startTimeRef.current = new Date();

        // Monitor for violations (silently, no alerts to student)
        const violationInterval = setInterval(() => {
          // Simulate proctoring checks (in production, use face-api.js)
          const events = [
            { type: "Looking away from screen", severity: 'low' as const },
            { type: "Multiple faces detected", severity: 'high' as const },
            { type: "Unauthorized device detected", severity: 'medium' as const },
            { type: "Audio detected", severity: 'low' as const },
          ];
          
          if (Math.random() > 0.85) {
            const event = events[Math.floor(Math.random() * events.length)];
            violationsRef.current.push({
              timestamp: new Date(),
              type: event.type,
              severity: event.severity
            });
          }
        }, 10000); // Check every 10 seconds

        return () => {
          clearInterval(violationInterval);
        };
      } catch (error) {
        console.error('Error accessing media devices:', error);
        toast({
          title: "Camera/Microphone Error",
          description: "Unable to access camera or microphone. Please check permissions.",
          variant: "destructive",
        });
      }
    };

    startRecording();

    return () => {
      isMounted = false;
      // Cleanup
      if (chunkIntervalRef.current) {
        clearInterval(chunkIntervalRef.current);
      }
      if (combinedStreamRef.current) {
        combinedStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (videoRecorderRef.current && videoRecorderRef.current.state !== 'inactive') {
        videoRecorderRef.current.stop();
      }
      if (audioRecorderRef.current && audioRecorderRef.current.state !== 'inactive') {
        audioRecorderRef.current.stop();
      }
    };
  }, []); // Only run once on mount

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Auto-submit when time runs out
          handleSubmitTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Ensure video stream is properly set when live feed becomes visible
  useEffect(() => {
    if (showLiveFeed && liveFeedRef.current && combinedStreamRef.current) {
      // Re-initialize video stream when feed becomes visible
      if (liveFeedRef.current.srcObject !== combinedStreamRef.current) {
        liveFeedRef.current.srcObject = combinedStreamRef.current;
      }
      liveFeedRef.current.play().catch((error) => {
        console.error('Error playing video:', error);
      });
    }
  }, [showLiveFeed]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmitTest = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);

    try {
      // Create promises to wait for recorders to stop
      const videoStopPromise = new Promise<void>((resolve) => {
        if (videoRecorderRef.current) {
          if (videoRecorderRef.current.state !== 'inactive') {
            videoRecorderRef.current.onstop = () => resolve();
            videoRecorderRef.current.stop();
          } else {
            resolve();
          }
        } else {
          resolve();
        }
      });

      const audioStopPromise = new Promise<void>((resolve) => {
        if (audioRecorderRef.current) {
          if (audioRecorderRef.current.state !== 'inactive') {
            audioRecorderRef.current.onstop = () => resolve();
            audioRecorderRef.current.stop();
          } else {
            resolve();
          }
        } else {
          resolve();
        }
      });

      // Wait for both recorders to stop
      await Promise.all([videoStopPromise, audioStopPromise]);

      // Stop camera/microphone streams
      if (combinedStreamRef.current) {
        combinedStreamRef.current.getTracks().forEach(track => track.stop());
      }

      // Combine video chunks
      const videoBlob = new Blob(videoChunksRef.current, { type: 'video/webm' });
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

      // Convert to base64
      const videoBase64 = await blobToBase64(videoBlob);
      const audioBase64 = await blobToBase64(audioBlob);


      // Get student ID and test ID (you may need to get these from context/params)
      const studentId = localStorage.getItem('studentId') || 'unknown';
      const testId = localStorage.getItem('testId') || 'test-1';

      // Submit test with recording
      const response = await fetch(getApiUrl('/api/student/submit-test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          testId,
          answers,
          videoBlob: videoBase64,
          audioBlob: audioBase64,
          startTime: startTimeRef.current?.toISOString(),
          endTime: new Date().toISOString(),
          violations: violationsRef.current
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Test Submitted",
          description: "Your exam has been submitted successfully",
        });
        navigate('/');
      } else {
        const error = await response.json();
        toast({
          title: "Submission Failed",
          description: error.message || "Failed to submit test. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Test submission error:', error);
      toast({
        title: "Error",
        description: "Failed to submit test. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to convert blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  return (
    <div className="min-h-screen bg-gradient-hero p-4 relative">
      {/* Live Camera Feed - Top Right Corner (Toggleable) */}
      {showLiveFeed && (
        <div className="fixed top-16 right-4 z-50 w-64 h-48 bg-black rounded-lg overflow-hidden shadow-2xl border-2 border-primary">
          <video
            ref={liveFeedRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover bg-black"
            style={{ transform: 'scaleX(-1)' }} // Mirror for better UX
            onLoadedMetadata={() => {
              if (liveFeedRef.current) {
                liveFeedRef.current.play().catch(console.error);
              }
            }}
          />
          <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            REC
          </div>
        </div>
      )}

      {/* Proctoring Header */}
      <div className="bg-card border-b sticky top-0 z-40 shadow-md">
        <div className="container max-w-7xl mx-auto py-3 px-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Left side: Pariksha AI and Proctoring Active */}
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-primary">Pariksha AI</h1>
              <Badge variant="outline" className="bg-success/10">
                <Eye className="w-3 h-3 mr-1" />
                Proctoring Active
              </Badge>
            </div>
            
            {/* Right side: Timer and Proctoring Logo */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-destructive font-semibold">
                <Clock className="w-5 h-5" />
                {formatTime(timeLeft)}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowLiveFeed(!showLiveFeed)}
                className="relative"
                title={showLiveFeed ? "Hide Live Feed" : "Show Live Feed"}
              >
                <ShieldCheck className="w-5 h-5 text-primary" />
                {isRecording && (
                  <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-7xl mx-auto py-6">
        <div className="grid lg:grid-cols-10 gap-6">
          {/* Main Test Area - 70% width */}
          <div className="lg:col-span-7 space-y-6">
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
                    disabled={currentQuestion === 0 || isSubmitting}
                    size="lg"
                    className="flex-1"
                  >
                    Previous
                  </Button>
                  {currentQuestion < questions.length - 1 ? (
                    <Button 
                      onClick={() => setCurrentQuestion(currentQuestion + 1)}
                      className="flex-1"
                      size="sm"
                      disabled={isSubmitting}
                    >
                      Next Question
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleSubmitTest} 
                      className="flex-1"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Test'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Question Navigator - 30% width */}
          <div className="lg:col-span-3 space-y-6">
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
                      className="w-full border-2 border-border aspect-square"
                      disabled={isSubmitting}
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

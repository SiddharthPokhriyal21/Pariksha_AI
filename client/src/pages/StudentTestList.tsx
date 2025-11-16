import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api-config";

interface Test {
  id: string;
  name: string;
  description?: string;
  scheduledDate: string;
  duration: number;
  status: string;
  questionCount: number;
}

const StudentTestList = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tests, setTests] = useState<Test[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTests = async () => {
      const studentId = localStorage.getItem('studentId');
      
      if (!studentId) {
        toast({
          title: "Error",
          description: "Student ID not found. Please login again.",
          variant: "destructive",
        });
        navigate('/student/login');
        return;
      }

      try {
        const response = await fetch(getApiUrl(`/api/student/tests?studentId=${studentId}`));
        
        if (response.ok) {
          const data = await response.json();
          setTests(data.tests || []);
        } else {
          const error = await response.json();
          toast({
            title: "Error",
            description: error.message || "Failed to load tests",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to connect to server. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchTests();
  }, [navigate, toast]);

  const handleStartTest = (testId: string) => {
    localStorage.setItem('testId', testId);
    navigate('/student/rules');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-hero p-4">
      <div className="container max-w-6xl mx-auto py-6">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
          <h1 className="text-3xl font-bold mb-2">My Tests</h1>
          <p className="text-muted-foreground">
            Select a test to begin. Make sure you're ready before starting.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-2">Loading tests...</span>
          </div>
        ) : tests.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No Tests Available</h3>
              <p className="text-muted-foreground">
                You don't have any scheduled tests at the moment.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tests.map((test) => (
              <Card key={test.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <CardTitle className="text-lg">{test.name}</CardTitle>
                    <Badge 
                      variant={test.status === 'active' ? 'default' : 'outline'}
                    >
                      {test.status}
                    </Badge>
                  </div>
                  {test.description && (
                    <CardDescription>{test.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{test.duration} minutes</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <strong>Scheduled:</strong> {formatDate(test.scheduledDate)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <strong>Questions:</strong> {test.questionCount}
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={() => handleStartTest(test.id)}
                  >
                    Start Test
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentTestList;


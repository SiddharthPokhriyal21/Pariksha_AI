import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, AlertTriangle, CheckCircle, Camera, Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const StudentReport = () => {
  const navigate = useNavigate();
  const { studentId, testId } = useParams();

  // Mock data
  const student = {
    name: "Bob Smith",
    email: "bob@example.com",
    actualScore: 87,
    trustScore: 75,
  };

  const violations = [
    { 
      time: "10:15:23", 
      type: "Multiple Faces Detected", 
      severity: "high",
      image: null // Would contain image data in real implementation
    },
    { 
      time: "10:22:45", 
      type: "Looking Away", 
      severity: "medium",
      image: null
    },
    { 
      time: "10:35:12", 
      type: "Phone Detected", 
      severity: "high",
      image: null
    },
  ];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      default: return 'secondary';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="bg-card border-b">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate(`/examiner/results/${testId}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Results
          </Button>
        </div>
      </div>

      <div className="container max-w-5xl mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">{student.name}</CardTitle>
                <CardDescription>{student.email}</CardDescription>
              </div>
              <div className="flex gap-4">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Actual Score</p>
                  <p className="text-3xl font-bold">{student.actualScore}%</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Trust Score</p>
                  <p className={`text-3xl font-bold ${student.trustScore >= 80 ? 'text-success' : 'text-warning'}`}>
                    {student.trustScore}%
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Total Violations</p>
                <p className="text-2xl font-bold mt-1">{violations.length}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Test Duration</p>
                <p className="text-2xl font-bold mt-1">58:34</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Questions Answered</p>
                <p className="text-2xl font-bold mt-1">25/25</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {violations.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Proctoring Violations
              </CardTitle>
              <CardDescription>
                Detected suspicious activities during the exam
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {violations.map((violation, index) => (
                <Alert key={index} variant={getSeverityColor(violation.severity) as any}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <AlertTitle className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {violation.time}
                      </AlertTitle>
                      <AlertDescription className="mt-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={getSeverityColor(violation.severity) as any}>
                            {violation.severity}
                          </Badge>
                          <span>{violation.type}</span>
                        </div>
                      </AlertDescription>
                    </div>
                    
                    <div className="ml-4 bg-muted rounded-lg w-48 h-32 flex items-center justify-center flex-shrink-0">
                      <Camera className="w-8 h-8 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground ml-2">Screenshot</p>
                    </div>
                  </div>
                </Alert>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-success/10 rounded-full">
                    <CheckCircle className="w-12 h-12 text-success" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">No Violations Detected</h3>
                <p className="text-muted-foreground">
                  This student completed the exam without any suspicious activity
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default StudentReport;

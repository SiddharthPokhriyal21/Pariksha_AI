import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, FileText, Plus, BarChart3, Users, LogOut } from "lucide-react";

const ExaminerDashboard = () => {
  const navigate = useNavigate();

  // Mock data
  const tests = [
    { id: 1, name: "Mathematics Final Exam", date: "2024-12-20", students: 45, status: "scheduled" },
    { id: 2, name: "Physics Midterm", date: "2024-12-18", students: 38, status: "completed" },
    { id: 3, name: "Chemistry Quiz", date: "2024-12-22", students: 50, status: "scheduled" },
  ];

  const stats = [
    { label: "Total Tests", value: "12", icon: FileText, color: "text-primary" },
    { label: "Active Students", value: "156", icon: Users, color: "text-secondary" },
    { label: "Completed", value: "8", icon: BarChart3, color: "text-success" },
    { label: "Scheduled", value: "4", icon: Calendar, color: "text-warning" },
  ];

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Examiner Dashboard</h1>
              <p className="text-muted-foreground">Manage tests and monitor students</p>
            </div>
            <Button variant="outline" onClick={() => navigate('/')}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="text-3xl font-bold mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-lg bg-muted ${stat.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/examiner/create-test')}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Plus className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Create New Test</CardTitle>
                  <CardDescription>Generate test using AI or manually</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-secondary/10 rounded-lg">
                  <Calendar className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <CardTitle>Schedule Test</CardTitle>
                  <CardDescription>Set date and invite students</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Tests List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Tests</CardTitle>
                <CardDescription>Manage and view test results</CardDescription>
              </div>
              <Button onClick={() => navigate('/examiner/create-test')}>
                <Plus className="mr-2 h-4 w-4" />
                Create Test
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tests.map((test) => (
                <div 
                  key={test.id} 
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => test.status === 'completed' && navigate(`/examiner/results/${test.id}`)}
                >
                  <div className="flex-1">
                    <h3 className="font-semibold">{test.name}</h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {test.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {test.students} students
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={test.status === 'completed' ? 'default' : 'secondary'}>
                      {test.status}
                    </Badge>
                    {test.status === 'completed' && (
                      <Button variant="outline" size="sm">
                        <BarChart3 className="mr-2 h-4 w-4" />
                        View Results
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExaminerDashboard;

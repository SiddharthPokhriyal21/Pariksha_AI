import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, FileText, Plus, BarChart3, Users, LogOut } from "lucide-react";
import { getApiUrl } from "@/lib/api-config";

type Stat = {
  label: string;
  value: string;
  icon?: any;
  color?: string;
};

type TestItem = {
  id: string;
  name: string;
  date: string;
  students: number;
  status: string;
};

const ExaminerDashboard = () => {
  const navigate = useNavigate();

  const [tests, setTests] = useState<TestItem[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Map backend color names to tailwind utility classes used in the UI
  const mapColorClass = (c?: string) => {
    if (!c) return 'text-primary';
    const map: Record<string, string> = {
      primary: 'text-primary',
      secondary: 'text-secondary',
      success: 'text-success',
      warning: 'text-warning',
    };
    return map[c] || 'text-primary';
  };

  // Map stat label to a sensible icon
  const statIconForLabel = (label: string) => {
    switch (label) {
      case 'Total Tests': return FileText;
      case 'Active Students': return Users;
      case 'Completed': return BarChart3;
      case 'Scheduled': return Calendar;
      default: return FileText;
    }
  };

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/examiner/dashboard'));
      if (!res.ok) throw new Error('Failed to fetch dashboard data');
      const data = await res.json();

      const statsWithIcons: Stat[] = (data.stats || []).map((s: any) => ({
        label: s.label,
        value: s.value,
        icon: statIconForLabel(s.label),
        color: mapColorClass(s.color),
      }));

      setStats(statsWithIcons);
      setTests((data.tests || []) as TestItem[]);
      setError(null);
    } catch (err: any) {
      console.error('Dashboard fetch error:', err);
      setError(err?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    // auto refresh every 60s
    const timer = setInterval(fetchDashboard, 60000);
    return () => clearInterval(timer);
  }, []);


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
          {loading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <Card key={idx}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Loading...</p>
                      <p className="text-3xl font-bold mt-1">—</p>
                    </div>
                    <div className={`p-3 rounded-lg bg-muted text-muted-foreground`}>
                      <FileText className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : error ? (
            <Card className="col-span-4">
              <CardContent>
                <p className="text-sm text-destructive">Error loading dashboard: {error}</p>
              </CardContent>
            </Card>
          ) : (
            stats.map((stat, index) => {
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
            })
          )}
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
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => fetchDashboard()}>
                  Refresh
                </Button>
                <Button onClick={() => navigate('/examiner/create-test')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Test
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                <div className="p-4 text-muted-foreground">Loading recent tests...</div>
              ) : error ? (
                <div className="p-4 text-destructive">Failed to load tests: {error}</div>
              ) : tests.length === 0 ? (
                <div className="p-4 text-muted-foreground">No recent tests found.</div>
              ) : (
                tests.map((test) => (
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
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExaminerDashboard;

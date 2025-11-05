import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, LogIn } from "lucide-react";
import WebcamCapture from "@/components/WebcamCapture";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api-config";

const ExaminerLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    photo: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.photo) {
      toast({
        title: "Photo Required",
        description: "Please capture your photo for face verification",
        variant: "destructive",
      });
      return;
    }

    // TODO: Verify with backend
    // console.log("Examiner Login:", formData);
    
    const response = await fetch(getApiUrl('/api/auth/examiner/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    if (response.ok) {
      const data = await response.json();
      // Store user token/info, then navigate
      toast({
        title: "Authentication Successful!",
        description: data.message,
      });
      navigate('/examiner/dashboard');
    } else {
      const error = await response.json();
      toast({
        title: "Login Failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <Card className="w-full max-w-xl animate-slide-up">
        <CardHeader>
          <Button 
            variant="ghost" 
            className="w-fit mb-4"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-secondary/10 rounded-lg">
              <LogIn className="w-6 h-6 text-secondary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Examiner Login</CardTitle>
              <CardDescription>Access your examination dashboard</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input 
                id="email"
                type="email"
                placeholder="examiner@example.com"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Face Verification</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Take a photo for identity verification
              </p>
              <WebcamCapture 
                onCapture={(imageData) => setFormData({...formData, photo: imageData})}
                capturedImage={formData.photo}
              />
            </div>

            <Button type="submit" className="w-full bg-secondary hover:bg-secondary/90" size="lg">
              <LogIn className="mr-2 h-4 w-4" />
              Login
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Button 
                variant="link" 
                className="p-0 h-auto"
                onClick={() => navigate('/examiner/register')}
              >
                Register here
              </Button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExaminerLogin;

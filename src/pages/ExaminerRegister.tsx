import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import WebcamCapture from "@/components/WebcamCapture";
import { useToast } from "@/hooks/use-toast";

const ExaminerRegister = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    photo: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.photo) {
      toast({
        title: "Photo Required",
        description: "Please capture your photo to complete registration",
        variant: "destructive",
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    // TODO: Send to backend
    console.log("Examiner Registration:", formData);
    
    toast({
      title: "Registration Successful!",
      description: "Your examiner account has been created. Please login.",
    });
    
    navigate('/examiner/login');
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl animate-slide-up">
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
              <ShieldCheck className="w-6 h-6 text-secondary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Examiner Registration</CardTitle>
              <CardDescription>Create your examiner account</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input 
                id="fullName"
                placeholder="Dr. Jane Smith"
                value={formData.fullName}
                onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                required
              />
            </div>

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

            <div className="grid md:grid-cols-2 gap-4">
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
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input 
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Profile Photo</Label>
              <WebcamCapture 
                onCapture={(imageData) => setFormData({...formData, photo: imageData})}
                capturedImage={formData.photo}
              />
            </div>

            <Button type="submit" className="w-full bg-secondary hover:bg-secondary/90" size="lg">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Register as Examiner
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExaminerRegister;

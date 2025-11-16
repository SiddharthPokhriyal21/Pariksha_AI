import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import StudentRegister from "./pages/StudentRegister";
import ExaminerRegister from "./pages/ExaminerRegister";
import StudentLogin from "./pages/StudentLogin";
import ExaminerLogin from "./pages/ExaminerLogin";
import StudentRules from "./pages/StudentRules";
import StudentTestList from "./pages/StudentTestList";
import StudentTest from "./pages/StudentTest";
import ExaminerDashboard from "./pages/ExaminerDashboard";
import CreateTest from "./pages/CreateTest";
import TestResults from "./pages/TestResults";
import StudentReport from "./pages/StudentReport";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/student/register" element={<StudentRegister />} />
          <Route path="/examiner/register" element={<ExaminerRegister />} />
          <Route path="/student/login" element={<StudentLogin />} />
          <Route path="/examiner/login" element={<ExaminerLogin />} />
          <Route path="/student/tests" element={<StudentTestList />} />
          <Route path="/student/rules" element={<StudentRules />} />
          <Route path="/student/test" element={<StudentTest />} />
          <Route path="/examiner/dashboard" element={<ExaminerDashboard />} />
          <Route path="/examiner/create-test" element={<CreateTest />} />
          <Route path="/examiner/results/:testId" element={<TestResults />} />
          <Route path="/examiner/report/:studentId/:testId" element={<StudentReport />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

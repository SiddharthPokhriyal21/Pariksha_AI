import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getToken } from '@/lib/api-config';
import { isTokenValid, getUserFromToken } from '@/lib/auth';

const RequireAuth = ({ children, role }: { children: JSX.Element; role?: 'student' | 'examiner' }) => {
  const location = useLocation();
  const token = getToken();
  if (!token || !isTokenValid(token)) {
    // token missing or expired
    return <Navigate to={role === 'examiner' ? '/examiner/login' : '/student/login'} state={{ from: location }} replace />;
  }

  if (role) {
    const user = getUserFromToken(token);
    if (!user || user.role !== role) {
      // role mismatch
      return <Navigate to={role === 'examiner' ? '/examiner/login' : '/student/login'} state={{ from: location }} replace />;
    }
  }

  return children;
};

export default RequireAuth;
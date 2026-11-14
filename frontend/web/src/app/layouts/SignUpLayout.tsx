import { Outlet } from 'react-router';
import { SignUpFlowProvider } from '../pages/auth/SignUpFlowContext';

export function SignUpLayout() {
  return (
    <SignUpFlowProvider>
      <div className="min-h-screen bg-[#0a0a0f]">
        <Outlet />
      </div>
    </SignUpFlowProvider>
  );
}

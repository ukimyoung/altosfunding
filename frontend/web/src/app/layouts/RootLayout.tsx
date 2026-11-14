import { Outlet } from 'react-router';
import { MyPageFooter } from '../components/mypage/MyPageFooter';

export function RootLayout() {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <main>
        <Outlet />
      </main>
      <div className="lg:pl-64">
        <MyPageFooter />
      </div>
    </div>
  );
}

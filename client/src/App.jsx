import { Navigate, Route, Routes } from 'react-router-dom';
import Leaderboard from './pages/Leaderboard.jsx';
import Admin from './pages/Admin.jsx';
import Tv from './pages/Tv.jsx';
import Judge from './pages/Judge.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Leaderboard />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/admin/judging" element={<Admin tab="judging" />} />
      <Route path="/admin/setup" element={<Admin tab="setup" />} />
      <Route path="/tv" element={<Tv />} />
      <Route path="/judge" element={<Judge />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

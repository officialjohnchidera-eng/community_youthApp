import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'


import ProfilePage from './pages/dashboard/ProfilePage'

// Public Pages
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'

// Dashboard Pages
import PaymentAuditPage from './pages/dashboard/PaymentAuditPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import PaymentsPage from './pages/dashboard/PaymentsPage'
import MeetingsPage from './pages/dashboard/MeetingsPage'
import AnnouncementsPage from './pages/dashboard/AnnouncementsPage'
import PollsPage from './pages/dashboard/PollsPage'
import MediaPage from './pages/dashboard/MediaPage'
import WelfarePage from './pages/dashboard/WelfarePage'
import MembersPage from './pages/dashboard/MembersPage'
import DocumentsPage from './pages/dashboard/DocumentsPage'
import DisciplinaryPage from './pages/dashboard/DisciplinaryPage'
import ReportsPage from './pages/dashboard/ReportsPage'
import NotificationsPage from './pages/dashboard/NotificationsPage'
import ApprovalsPage from './pages/dashboard/ApprovalsPage'
import ClearancePage from './pages/dashboard/ClearancePage'

const LoadingScreen = () => (
  <div className="min-h-screen bg-gray-900 flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-emerald-400 text-lg font-medium">Loading...</p>
    </div>
  </div>
)

// Any logged in user
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" />
  return children
}

// Must be approved
const ApprovedRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" />
  if (user.account_status !== 'approved') return <Navigate to="/dashboard" />
  return children
}

// Must be executive
const ExecRoute = ({ children }) => {
  const { user, loading } = useAuth()
  const execPositions = [
    'General President', 'Vice President',
    'General Treasurer', 'Assistant Treasurer',
    'Financial Secretary', 'Assistant Financial Secretary',
    'General Secretary', 'Assistant Secretary',
    'Public Relation Officer', 'Welfare Officer',
    'Provost', 'Assistant Provost'
  ]
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" />
  if (!user.position || !execPositions.includes(user.position)) return <Navigate to="/dashboard" />
  return children
}

// Must be President or VP
const PresidentRoute = ({ children }) => {
  const { user, loading } = useAuth()
  console.log('PresidentRoute user:', user)
  console.log('PresidentRoute position:', user?.position)
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" />
  if (!user.position || !['General President', 'Vice President'].includes(user.position)) return <Navigate to="/dashboard" />
  return children
}

// Must hold one of the positions authorized to view member clearance
// standing: President, VP, General Secretary, PRO, Financial Secretary.
// Deliberately narrower than ExecRoute, since this surfaces another
// member's personal financial history.
const ClearanceRoute = ({ children }) => {
  const { user, loading } = useAuth()
  const clearancePositions = [
    'General President', 'Vice President',
    'General Secretary', 'Public Relation Officer',
    'Financial Secretary'
  ]
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" />
  if (!user.position || !clearancePositions.includes(user.position)) return <Navigate to="/dashboard" />
  return children
}

// Logged out only
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (user) return <Navigate to="/dashboard" />
  return children
}

export default function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
      <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />

      {/* Protected Dashboard Routes */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/dashboard/payments" element={<ApprovedRoute><PaymentsPage /></ApprovedRoute>} />
      <Route path="/dashboard/meetings" element={<ApprovedRoute><MeetingsPage /></ApprovedRoute>} />
      <Route path="/dashboard/profile" element={<ApprovedRoute><ProfilePage /></ApprovedRoute>} />
      <Route path="/dashboard/announcements" element={<ApprovedRoute><AnnouncementsPage /></ApprovedRoute>} />
      <Route path="/dashboard/polls" element={<ApprovedRoute><PollsPage /></ApprovedRoute>} />
      <Route path="/dashboard/media" element={<ApprovedRoute><MediaPage /></ApprovedRoute>} />
      <Route path="/dashboard/welfare" element={<ApprovedRoute><WelfarePage /></ApprovedRoute>} />
      <Route path="/dashboard/members" element={<ApprovedRoute><MembersPage /></ApprovedRoute>} />
      <Route path="/dashboard/documents" element={<ApprovedRoute><DocumentsPage /></ApprovedRoute>} />
      <Route path="/dashboard/disciplinary" element={<ExecRoute><DisciplinaryPage /></ExecRoute>} />
      <Route path="/dashboard/reports" element={<ExecRoute><ReportsPage /></ExecRoute>} />
      <Route path="/dashboard/notifications" element={<ApprovedRoute><NotificationsPage /></ApprovedRoute>} />
      <Route path="/dashboard/approvals" element={<PresidentRoute><ApprovalsPage /></PresidentRoute>} />
      <Route path="/dashboard/payments/:id/audit" element={<ApprovedRoute><PaymentAuditPage /></ApprovedRoute>} />
      <Route path="/dashboard/clearance" element={<ClearanceRoute><ClearancePage /></ClearanceRoute>} />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

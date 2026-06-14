import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import leopard from '../assets/leopard.jpg'
import api from '../api/axios'
import {
  FaHome, FaMoneyBillWave, FaCalendarAlt, FaBullhorn,
  FaUsers, FaPhotoVideo, FaHeart, FaGavel, FaPoll,
  FaFileAlt, FaBell, FaSignOutAlt, FaBars, FaTimes,
  FaUserCheck, FaChartBar, FaCalendar, FaMoneyBill
} from 'react-icons/fa'

const getNavItems = (user) => {
  if (user?.account_status !== 'approved') return [
    { path: '/dashboard', icon: <FaHome />, label: 'Dashboard' },
  ]

  const base = [
    { path: '/dashboard', icon: <FaHome />, label: 'Dashboard' },
    { path: '/dashboard/payments', icon: <FaMoneyBillWave />, label: 'Payments' },
    { path: '/dashboard/meetings', icon: <FaCalendarAlt />, label: 'Meetings' },
    { path: '/dashboard/announcements', icon: <FaBullhorn />, label: 'Announcements' },
    { path: '/dashboard/polls', icon: <FaPoll />, label: 'Polls' },
    { path: '/dashboard/media', icon: <FaPhotoVideo />, label: 'Media Gallery' },
    { path: '/dashboard/welfare', icon: <FaHeart />, label: 'Welfare' },
    { path: '/dashboard/members', icon: <FaUsers />, label: 'Members' },
  ]

  const executiveItems = [
    { path: '/dashboard/documents', icon: <FaFileAlt />, label: 'Documents' },
    { path: '/dashboard/disciplinary', icon: <FaGavel />, label: 'Disciplinary' },
    { path: '/dashboard/reports', icon: <FaChartBar />, label: 'Reports' },
    { path: '/dashboard/notifications', icon: <FaBell />, label: 'Notifications' },
  ]

  const adminItems = [
    { path: '/dashboard/approvals', icon: <FaUserCheck />, label: 'Approvals' },
  ]

  const execPositions = ['General President', 'Vice President', 'General Treasurer', 'Assistant Treasurer', 'Financial Secretary', 'Assistant Financial Secretary', 'General Secretary', 'Assistant Secretary', 'Public Relation Officer', 'Welfare Officer', 'Provost', 'Assistant Provost']

  if (user?.position && execPositions.includes(user.position)) {
    if (['General President', 'Vice President'].includes(user.position)) {
      return [...base, ...executiveItems, ...adminItems]
    }
    return [...base, ...executiveItems]
  }

  return base
}

const getNotifIcon = (type) => {
  if (type === 'payment') return <FaMoneyBillWave className="text-emerald-400" size={12} />
  if (type === 'meeting') return <FaCalendarAlt className="text-blue-400" size={12} />
  if (type === 'announcement') return <FaBullhorn className="text-purple-400" size={12} />
  return <FaBell className="text-yellow-400" size={12} />
}

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const navItems = getNavItems(user)

  useEffect(() => {
    fetchNotifications()
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications/my-notifications/')
      setNotifications(res.data.slice(0, 5))
      setUnreadCount(res.data.filter(n => !n.is_read).length)
    } catch (error) {
      // silently fail
    }
  }

  const markAsRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read/`)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      // silently fail
    }
  }

  const markAllRead = async () => {
    try {
      await api.post('/notifications/mark-all-read/')
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
      toast.success('All notifications marked as read!')
    } catch (error) {
      // silently fail
    }
  }

  const handleLogout = async () => {
    await logout()
    toast.success('Logged out successfully!')
    navigate('/')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <img src={leopard} alt="Logo" className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500" />
          <div>
            <h1 className="text-white font-bold text-sm leading-none">Umuagu Youth</h1>
            <p className="text-emerald-400 text-xs">General Association</p>
          </div>
        </div>
      </div>

      {/* User Profile */}
      <div className="p-4 border-b border-gray-800">
        <div className="bg-gray-800 rounded-xl p-3 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <div className="overflow-hidden">
            <p className="text-white font-semibold text-sm truncate">{user?.first_name} {user?.last_name}</p>
            <p className="text-emerald-400 text-xs truncate">{user?.user_id}</p>
            <p className="text-gray-500 text-xs truncate">{user?.position || user?.role?.replace('_', ' ')}</p>
          </div>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
                isActive
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all text-sm font-medium"
        >
          <FaSignOutAlt />
          Logout
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-900 flex">

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 flex-col bg-gray-950 border-r border-gray-800 fixed h-full z-30">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25 }}
              className="fixed left-0 top-0 h-full w-64 bg-gray-950 border-r border-gray-800 z-50 lg:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 lg:ml-64 flex flex-col">

        {/* Top Header */}
        <header className="bg-gray-950 border-b border-gray-800 px-4 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-400 hover:text-white transition-colors"
            >
              <FaBars size={20} />
            </button>
            <div>
              <h2 className="text-white font-semibold text-base">
                Welcome back, {user?.first_name}! 👋
              </h2>
              <p className="text-gray-500 text-xs">{new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Account Status Badge */}
            <div className={`hidden md:block px-3 py-1 rounded-full text-xs font-medium ${
              user?.account_status === 'approved'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
            }`}>
              {user?.account_status}
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative w-9 h-9 bg-gray-800 border border-gray-700 rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:border-emerald-500/50 transition-all"
              >
                <FaBell size={14} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              <AnimatePresence>
                {notifOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-12 w-80 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl z-40 overflow-hidden"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between p-4 border-b border-gray-800">
                        <div className="flex items-center gap-2">
                          <h3 className="text-white font-semibold text-sm">Notifications</h3>
                          {unreadCount > 0 && (
                            <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">{unreadCount}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {unreadCount > 0 && (
                            <button onClick={markAllRead} className="text-emerald-400 text-xs hover:text-emerald-300 transition-colors">
                              Mark all read
                            </button>
                          )}
                          <button onClick={() => setNotifOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                            <FaTimes size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Notifications List */}
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length > 0 ? notifications.map((notif, i) => (
                          <div
                            key={i}
                            onClick={() => { markAsRead(notif.id); setNotifOpen(false); navigate('/dashboard/notifications') }}
                            className={`flex items-start gap-3 p-4 border-b border-gray-800 cursor-pointer hover:bg-gray-800 transition-colors ${!notif.is_read ? 'bg-gray-800/50' : ''}`}
                          >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${!notif.is_read ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-gray-800 border border-gray-700'}`}>
                              {getNotifIcon(notif.notification_type)}
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <div className="flex items-center justify-between gap-2">
                                <p className={`text-xs font-medium truncate ${!notif.is_read ? 'text-white' : 'text-gray-400'}`}>{notif.title}</p>
                                {!notif.is_read && <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full flex-shrink-0"></div>}
                              </div>
                              <p className="text-gray-500 text-xs mt-0.5 truncate">{notif.message}</p>
                              <p className="text-gray-600 text-xs mt-1">{new Date(notif.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                            </div>
                          </div>
                        )) : (
                          <div className="text-center py-8">
                            <FaBell className="text-gray-600 mx-auto mb-2" size={24} />
                            <p className="text-gray-500 text-sm">No notifications yet</p>
                          </div>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="p-3 border-t border-gray-800">
                        <Link
                          to="/dashboard/notifications"
                          onClick={() => setNotifOpen(false)}
                          className="block text-center text-emerald-400 text-xs hover:text-emerald-300 transition-colors py-1"
                        >
                          View all notifications
                        </Link>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Avatar */}
            <div className="w-9 h-9 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

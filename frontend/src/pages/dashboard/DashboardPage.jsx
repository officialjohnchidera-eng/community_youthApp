import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import {
  FaMoneyBillWave, FaCalendarAlt, FaBullhorn, FaUsers,
  FaPoll, FaHeart, FaArrowRight, FaCheckCircle, FaClock
} from 'react-icons/fa'
import DashboardLayout from '../../components/DashboardLayout'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'

export default function DashboardPage() {
  const { user } = useAuth()
  const [announcements, setAnnouncements] = useState([])
  const [meetings, setMeetings] = useState([])
  const [payments, setPayments] = useState([])
  const [polls, setPolls] = useState([])
  const [loading, setLoading] = useState(true)

  const paymentChartData = payments.reduce((acc, payment) => {
    if (payment.status !== 'success') return acc
    const month = new Date(payment.created_at).toLocaleDateString('en-GB', { month: 'short' })
    const existing = acc.find(a => a.month === month)
    if (existing) existing.amount += parseFloat(payment.amount || 0)
    else acc.push({ month, amount: parseFloat(payment.amount || 0) })
    return acc
  }, [])

  useEffect(() => {
    if (user?.account_status !== 'approved') {
      setLoading(false)
      return
    }
    const fetchData = async () => {
      try {
        const [annRes, meetRes, payRes, pollRes] = await Promise.all([
          api.get('/organization/announcements/').catch(() => ({ data: [] })),
          api.get('/events/meetings/').catch(() => ({ data: [] })),
          api.get('/payments/history/').catch(() => ({ data: [] })),
          api.get('/organization/polls/').catch(() => ({ data: [] })),
        ])
        setAnnouncements(annRes.data.slice(0, 3))
        setMeetings(meetRes.data.slice(0, 3))
        setPayments(payRes.data.slice(0, 3))
        setPolls(pollRes.data.slice(0, 2))
      } catch (error) {
        console.log('Dashboard fetch error:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [user])

  const stats = [
    {
      label: 'Payment Status',
      value: payments.length > 0 ? payments[0].status : 'No payments',
      icon: <FaMoneyBillWave />,
      color: 'emerald',
      link: '/dashboard/payments'
    },
    {
      label: 'Upcoming Meetings',
      value: meetings.filter(m => m.status === 'upcoming').length,
      icon: <FaCalendarAlt />,
      color: 'blue',
      link: '/dashboard/meetings'
    },
    {
      label: 'Announcements',
      value: announcements.length,
      icon: <FaBullhorn />,
      color: 'purple',
      link: '/dashboard/announcements'
    },
    {
      label: 'Active Polls',
      value: polls.filter(p => p.status === 'active').length,
      icon: <FaPoll />,
      color: 'yellow',
      link: '/dashboard/polls'
    },
  ]

  const colorMap = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  }

  if (loading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    </DashboardLayout>
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Pending Warning */}
        {user?.account_status !== 'approved' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6 flex flex-col items-center text-center gap-4"
          >
            <div className="w-16 h-16 bg-yellow-500/10 border border-yellow-500/30 rounded-full flex items-center justify-center">
              <FaClock className="text-yellow-400" size={28} />
            </div>
            <div>
              <p className="text-yellow-400 font-bold text-lg">Account Pending Approval</p>
              <p className="text-gray-400 text-sm mt-2 max-w-md">
                Your account is awaiting approval from the President or Vice President. 
                You will receive an email and notification once your account has been reviewed.
              </p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 w-full max-w-sm">
              <p className="text-gray-400 text-xs">While you wait, make sure your registration details are correct. If you were rejected, you can resubmit from your profile page.</p>
            </div>
          </motion.div>
        )}

        {/* Everything below only for approved members */}
        {user?.account_status === 'approved' && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Link to={stat.link} className={`block bg-gray-800 border rounded-2xl p-4 hover:shadow-lg transition-all hover:scale-105 ${colorMap[stat.color]}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 border ${colorMap[stat.color]}`}>
                      {stat.icon}
                    </div>
                    <p className="text-white font-bold text-xl">{stat.value}</p>
                    <p className="text-gray-400 text-xs mt-1">{stat.label}</p>
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* Chart + Announcements */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="lg:col-span-2 bg-gray-800 border border-gray-700 rounded-2xl p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-white font-semibold text-lg">Payment Overview</h3>
                    <p className="text-gray-400 text-sm">Successful payments by month</p>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-3 py-1 rounded-full">
                    NGN
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={paymentChartData.length > 0 ? paymentChartData : [{ month: 'No data', amount: 0 }]}>
                    <defs>
                      <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="month" stroke="#6b7280" tick={{ fill: '#6b7280', fontSize: 12 }} />
                    <YAxis stroke="#6b7280" tick={{ fill: '#6b7280', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '12px' }}
                      labelStyle={{ color: '#f9fafb' }}
                      itemStyle={{ color: '#10b981' }}
                      formatter={(value) => [`NGN ${value.toLocaleString()}`, 'Amount']}
                    />
                    <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} fill="url(#colorAmount)" />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gray-800 border border-gray-700 rounded-2xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold">Announcements</h3>
                  <Link to="/dashboard/announcements" className="text-emerald-400 text-xs hover:text-emerald-300 flex items-center gap-1">
                    View all <FaArrowRight size={10} />
                  </Link>
                </div>
                <div className="space-y-3">
                  {announcements.length > 0 ? announcements.map((ann, i) => (
                    <div key={i} className="bg-gray-900 rounded-xl p-3 border border-gray-700">
                      <div className="flex items-start gap-2">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${ann.category === 'urgent' ? 'bg-red-400' : ann.category === 'payment' ? 'bg-yellow-400' : 'bg-emerald-400'}`}></div>
                        <div>
                          <p className="text-white text-sm font-medium leading-tight">{ann.title}</p>
                          <p className="text-gray-500 text-xs mt-1">{new Date(ann.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <p className="text-gray-500 text-sm text-center py-4">No announcements yet</p>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Meetings + Polls */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-gray-800 border border-gray-700 rounded-2xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold">Upcoming Meetings</h3>
                  <Link to="/dashboard/meetings" className="text-emerald-400 text-xs hover:text-emerald-300 flex items-center gap-1">
                    View all <FaArrowRight size={10} />
                  </Link>
                </div>
                <div className="space-y-3">
                  {meetings.length > 0 ? meetings.map((meeting, i) => (
                    <div key={i} className="bg-gray-900 rounded-xl p-4 border border-gray-700 flex items-center gap-4">
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-center flex-shrink-0">
                        <p className="text-emerald-400 font-bold text-lg leading-none">{new Date(meeting.date).getDate()}</p>
                        <p className="text-emerald-400 text-xs">{new Date(meeting.date).toLocaleDateString('en-GB', { month: 'short' })}</p>
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-white font-medium text-sm truncate">{meeting.title}</p>
                        <p className="text-gray-400 text-xs mt-0.5">{meeting.venue} • {meeting.time}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${meeting.status === 'upcoming' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-700 text-gray-400'}`}>
                          {meeting.status}
                        </span>
                      </div>
                    </div>
                  )) : (
                    <p className="text-gray-500 text-sm text-center py-4">No meetings scheduled</p>
                  )}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-gray-800 border border-gray-700 rounded-2xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold">Active Polls</h3>
                  <Link to="/dashboard/polls" className="text-emerald-400 text-xs hover:text-emerald-300 flex items-center gap-1">
                    View all <FaArrowRight size={10} />
                  </Link>
                </div>
                <div className="space-y-3">
                  {polls.filter(p => p.status === 'active').length > 0 ? polls.filter(p => p.status === 'active').map((poll, i) => (
                    <div key={i} className="bg-gray-900 rounded-xl p-4 border border-gray-700">
                      <p className="text-white font-medium text-sm mb-3">{poll.question}</p>
                      <div className="space-y-2">
                        {poll.options?.slice(0, 2).map((option, j) => (
                          <div key={j} className="flex items-center justify-between">
                            <p className="text-gray-400 text-xs truncate flex-1">{option.text}</p>
                            <span className="text-emerald-400 text-xs ml-2">{option.vote_count} votes</span>
                          </div>
                        ))}
                      </div>
                      <Link to="/dashboard/polls" className="mt-3 w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs py-2 rounded-lg hover:bg-emerald-500/20 transition-all block text-center">
                        Vote Now
                      </Link>
                    </div>
                  )) : (
                    <p className="text-gray-500 text-sm text-center py-4">No active polls</p>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-gray-800 border border-gray-700 rounded-2xl p-6"
            >
              <h3 className="text-white font-semibold mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Pay Dues', icon: <FaMoneyBillWave />, link: '/dashboard/payments', color: 'emerald' },
                  { label: 'View Members', icon: <FaUsers />, link: '/dashboard/members', color: 'blue' },
                  { label: 'Welfare Records', icon: <FaHeart />, link: '/dashboard/welfare', color: 'pink' },
                  { label: 'Media Gallery', icon: <FaBullhorn />, link: '/dashboard/media', color: 'purple' },
                ].map((action, i) => (
                  <Link
                    key={i}
                    to={action.link}
                    className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-emerald-500/50 hover:bg-gray-800 transition-all text-center"
                  >
                    <div className="text-emerald-400 text-xl">{action.icon}</div>
                    <p className="text-gray-300 text-xs font-medium">{action.label}</p>
                  </Link>
                ))}
              </div>
            </motion.div>
          </>
        )}

      </div>
    </DashboardLayout>
  )
}
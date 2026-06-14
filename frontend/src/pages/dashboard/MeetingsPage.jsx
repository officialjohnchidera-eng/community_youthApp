import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FaCalendarAlt, FaMapMarkerAlt, FaClock, FaUsers, FaPlus, FaTimes } from 'react-icons/fa'
import DashboardLayout from '../../components/DashboardLayout'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'

export default function MeetingsPage() {
  const { user } = useAuth()
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('upcoming')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showMinutesModal, setShowMinutesModal] = useState(false)
  const [minutesTarget, setMinutesTarget] = useState(null)
  const [minutesText, setMinutesText] = useState('')
  const [savingMinutes, setSavingMinutes] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    time: '',
    venue: '',
    agenda: '',
  })

  const isSecretary = user?.position &&
    ['General Secretary', 'Assistant Secretary', 'General President', 'Vice President'].includes(user.position)

  useEffect(() => {
    fetchMeetings()
  }, [])

  const fetchMeetings = async () => {
    try {
      const res = await api.get('/events/meetings/')
      setMeetings(res.data)
    } catch (error) {
      console.log('Meetings fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      await api.post('/events/meetings/create/', formData)
      toast.success('Meeting created successfully!')
      setShowCreateModal(false)
      setFormData({ title: '', date: '', time: '', venue: '', agenda: '' })
      fetchMeetings()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create meeting')
    } finally {
      setCreating(false)
    }
  }

  const handleSaveMinutes = async (e) => {
    e.preventDefault()
    setSavingMinutes(true)
    try {
      await api.post(`/events/meetings/${minutesTarget.id}/minutes/`, { minutes: minutesText })
      toast.success('Minutes saved successfully!')
      setShowMinutesModal(false)
      setMinutesTarget(null)
      setMinutesText('')
      fetchMeetings()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save minutes')
    } finally {
      setSavingMinutes(false)
    }
  }

  const upcomingMeetings = meetings.filter(m => m.status === 'upcoming')
  const completedMeetings = meetings.filter(m => m.status === 'completed')
  const cancelledMeetings = meetings.filter(m => m.status === 'cancelled')

  const statusColor = (status) => {
    if (status === 'upcoming') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    if (status === 'completed') return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
    return 'bg-red-500/10 text-red-400 border-red-500/30'
  }

  const MeetingCard = ({ meeting }) => (
    <motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  className="bg-gray-900 border border-gray-700 rounded-2xl p-4 hover:border-emerald-500/30 transition-all w-full overflow-hidden"
>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-start gap-3">
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-2.5 text-center flex-shrink-0 min-w-[48px]">
            <p className="text-emerald-400 font-bold text-xl leading-none">{new Date(meeting.date).getDate()}</p>
            <p className="text-emerald-400 text-xs mt-0.5">{new Date(meeting.date).toLocaleDateString('en-GB', { month: 'short' })}</p>
            <p className="text-gray-500 text-xs">{new Date(meeting.date).getFullYear()}</p>
          </div>
          <div className="min-w-0">
            <h3 className="text-white font-semibold text-sm">{meeting.title}</h3>
            <div className="flex items-center gap-1.5 mt-1">
              <FaMapMarkerAlt className="text-gray-500 flex-shrink-0" size={10} />
              <p className="text-gray-400 text-xs truncate">{meeting.venue}</p>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <FaClock className="text-gray-500 flex-shrink-0" size={10} />
              <p className="text-gray-400 text-xs">{meeting.time}</p>
            </div>
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${statusColor(meeting.status)}`}>
          {meeting.status}
        </span>
      </div>

      {meeting.agenda && (
        <div className="bg-gray-800 rounded-xl p-3">
          <p className="text-gray-400 text-xs font-medium mb-1">Agenda</p>
          <p className="text-gray-300 text-xs">{meeting.agenda}</p>
        </div>
      )}

      {meeting.attendances?.length > 0 && (
        <div className="flex items-center gap-2 mt-2">
          <FaUsers className="text-gray-500" size={10} />
          <p className="text-gray-400 text-xs">{meeting.attendances.length} attendance records</p>
        </div>
      )}

      {meeting.total_expenditure > 0 && (
        <div className="mt-1.5">
          <p className="text-gray-400 text-xs">
            Expenditure: <span className="text-emerald-400 font-medium">NGN {parseFloat(meeting.total_expenditure).toLocaleString()}</span>
          </p>
        </div>
      )}


      {meeting.minutes && (
  <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 mt-2 w-full overflow-hidden">
    <p className="text-blue-400 text-xs font-medium mb-1">Meeting Minutes</p>
    <p className="text-gray-300 text-xs break-all line-clamp-3">{meeting.minutes}</p>
    <p className="text-blue-400/60 text-xs mt-1">Click Edit Minutes to view full</p>
  </div>
)}

      {isSecretary && meeting.status === 'completed' && (
        <button
          onClick={() => {
            setMinutesTarget(meeting)
            setMinutesText(meeting.minutes || '')
            setShowMinutesModal(true)
          }}
          className="mt-2 w-full bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 py-2 rounded-xl text-xs font-medium transition-all"
        >
          {meeting.minutes ? 'Edit Minutes' : '+ Add Minutes'}
        </button>
      )}
    </motion.div>
  )

  return (
    <DashboardLayout>
      <div className="space-y-4">

        {/* Header */}
       <div className="flex items-start justify-between gap-2">
  <div className="min-w-0 flex-1">
    <h1 className="text-xl font-bold text-white">Meetings</h1>
    <p className="text-gray-400 text-xs mt-0.5">View and manage all organization meetings</p>
  </div>
  {isSecretary && (
    <button
      onClick={() => setShowCreateModal(true)}
      className="bg-emerald-500 hover:bg-emerald-600 text-white px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1 transition-all flex-shrink-0 whitespace-nowrap"
    >
      <FaPlus size={9} />
      Create Meeting
    </button>
  )}
</div>


        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Upcoming', value: upcomingMeetings.length, color: 'emerald' },
            { label: 'Completed', value: completedMeetings.length, color: 'blue' },
            { label: 'Cancelled', value: cancelledMeetings.length, color: 'red' },
          ].map((stat, i) => (
            <div key={i} className="bg-gray-800 border border-gray-700 rounded-2xl p-3 text-center">
              <p className={`text-xl font-bold ${stat.color === 'emerald' ? 'text-emerald-400' : stat.color === 'blue' ? 'text-blue-400' : 'text-red-400'}`}>
                {stat.value}
              </p>
              <p className="text-gray-400 text-xs mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1">
          {[
            { key: 'upcoming', label: `Upcoming (${upcomingMeetings.length})` },
            { key: 'completed', label: `Completed (${completedMeetings.length})` },
            { key: 'cancelled', label: `Cancelled (${cancelledMeetings.length})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-1.5 px-1 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.key ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Meetings List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {activeTab === 'upcoming' && (
              upcomingMeetings.length > 0
                ? upcomingMeetings.map((m, i) => <MeetingCard key={i} meeting={m} />)
                : <div className="text-center py-12 bg-gray-800 border border-gray-700 rounded-2xl">
                    <FaCalendarAlt className="text-gray-600 mx-auto mb-3" size={32} />
                    <p className="text-gray-400 text-sm">No upcoming meetings</p>
                  </div>
            )}
            {activeTab === 'completed' && (
              completedMeetings.length > 0
                ? completedMeetings.map((m, i) => <MeetingCard key={i} meeting={m} />)
                : <div className="text-center py-12 bg-gray-800 border border-gray-700 rounded-2xl">
                    <FaCalendarAlt className="text-gray-600 mx-auto mb-3" size={32} />
                    <p className="text-gray-400 text-sm">No completed meetings</p>
                  </div>
            )}
            {activeTab === 'cancelled' && (
              cancelledMeetings.length > 0
                ? cancelledMeetings.map((m, i) => <MeetingCard key={i} meeting={m} />)
                : <div className="text-center py-12 bg-gray-800 border border-gray-700 rounded-2xl">
                    <FaCalendarAlt className="text-gray-600 mx-auto mb-3" size={32} />
                    <p className="text-gray-400 text-sm">No cancelled meetings</p>
                  </div>
            )}
          </div>
        )}
      </div>

      {/* Create Meeting Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800 border border-gray-700 rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-bold text-lg">Create Meeting</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Meeting Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. March General Meeting"
                  required
                  className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-300 text-sm font-medium mb-2 block">Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    required
                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-gray-300 text-sm font-medium mb-2 block">Time</label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={e => setFormData({ ...formData, time: e.target.value })}
                    required
                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Venue</label>
                <input
                  type="text"
                  value={formData.venue}
                  onChange={e => setFormData({ ...formData, venue: e.target.value })}
                  placeholder="e.g. Community Hall"
                  required
                  className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Agenda</label>
                <textarea
                  value={formData.agenda}
                  onChange={e => setFormData({ ...formData, agenda: e.target.value })}
                  placeholder="Meeting agenda..."
                  rows={3}
                  className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={creating}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-800 text-white py-3 rounded-xl transition-all font-semibold">
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Minutes Modal */}
      {showMinutesModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800 border border-gray-700 rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-bold text-lg">Meeting Minutes</h3>
              <button onClick={() => setShowMinutesModal(false)} className="text-gray-400 hover:text-white">
                <FaTimes />
              </button>
            </div>
            <p className="text-emerald-400 text-xs mb-4">{minutesTarget?.title}</p>
            <form onSubmit={handleSaveMinutes} className="space-y-4">
              <textarea
                value={minutesText}
                onChange={e => setMinutesText(e.target.value)}
                placeholder="Type meeting minutes here... Include key decisions, action points and who is responsible."
                rows={10}
                required
                className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 resize-none text-sm"
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowMinutesModal(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={savingMinutes}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-800 text-white py-3 rounded-xl transition-all font-semibold">
                  {savingMinutes ? 'Saving...' : 'Save Minutes'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </DashboardLayout>
  )
}
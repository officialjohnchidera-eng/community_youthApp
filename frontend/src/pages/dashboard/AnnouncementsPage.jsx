import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FaBullhorn, FaPlus, FaTimes, FaExclamationCircle, FaInfoCircle, FaMoneyBillWave, FaCalendarAlt } from 'react-icons/fa'
import DashboardLayout from '../../components/DashboardLayout'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'

export default function AnnouncementsPage() {
  const { user } = useAuth()
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'general',
  })

  const canCreate = user?.position &&
    ['General Secretary', 'Assistant Secretary', 'General President', 'Vice President', 'Public Relation Officer'].includes(user.position)

  useEffect(() => {
    fetchAnnouncements()
  }, [])

  const fetchAnnouncements = async () => {
    try {
      const res = await api.get('/organization/announcements/')
      setAnnouncements(res.data)
    } catch (error) {
      console.log('Announcements fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      await api.post('/organization/announcements/create/', formData)
      toast.success('Announcement created successfully!')
      setShowCreateModal(false)
      setFormData({ title: '', content: '', category: 'general' })
      fetchAnnouncements()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create announcement')
    } finally {
      setCreating(false)
    }
  }

  const categoryIcon = (category) => {
    if (category === 'urgent') return <FaExclamationCircle className="text-red-400" />
    if (category === 'payment') return <FaMoneyBillWave className="text-yellow-400" />
    if (category === 'meeting') return <FaCalendarAlt className="text-blue-400" />
    return <FaInfoCircle className="text-emerald-400" />
  }

  const categoryColor = (category) => {
    if (category === 'urgent') return 'bg-red-500/10 text-red-400 border-red-500/30'
    if (category === 'payment') return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
    if (category === 'meeting') return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
  }

  const filtered = activeTab === 'all' ? announcements : announcements.filter(a => a.category === activeTab)

  return (
    <DashboardLayout>
      <div className="space-y-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-white">Announcements</h1>
            <p className="text-gray-400 text-xs mt-0.5">Stay updated with the latest news</p>
          </div>
          {canCreate && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1 transition-all flex-shrink-0 whitespace-nowrap"
            >
              <FaPlus size={9} />
              New Announcement
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1 overflow-x-auto">
          {[
            { key: 'all', label: `All (${announcements.length})` },
            { key: 'urgent', label: '🚨 Urgent' },
            { key: 'payment', label: '💰 Payment' },
            { key: 'meeting', label: '📅 Meeting' },
            { key: 'general', label: '📢 General' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-shrink-0 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.key ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Announcements List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((ann, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-gray-800 border border-gray-700 rounded-2xl p-4 hover:border-emerald-500/30 transition-all w-full overflow-hidden"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${categoryColor(ann.category)}`}>
                    {categoryIcon(ann.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-white font-semibold text-sm truncate">{ann.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${categoryColor(ann.category)}`}>
                        {ann.category}
                      </span>
                    </div>
                    <p className="text-gray-400 text-xs mt-1.5 leading-relaxed break-words">{ann.content}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <p className="text-gray-500 text-xs">By {ann.created_by}</p>
                      <p className="text-gray-500 text-xs">{new Date(ann.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-gray-800 border border-gray-700 rounded-2xl">
            <FaBullhorn className="text-gray-600 mx-auto mb-3" size={40} />
            <p className="text-gray-400 font-medium">No announcements yet</p>
            <p className="text-gray-500 text-sm mt-1">Check back later for updates</p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800 border border-gray-700 rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-bold text-lg">New Announcement</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Announcement title"
                  required
                  className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Category</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500"
                >
                  <option value="general">General</option>
                  <option value="urgent">Urgent</option>
                  <option value="payment">Payment</option>
                  <option value="meeting">Meeting</option>
                </select>
              </div>
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Content</label>
                <textarea
                  value={formData.content}
                  onChange={e => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Write your announcement here..."
                  rows={4}
                  required
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
                  {creating ? 'Posting...' : 'Post'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </DashboardLayout>
  )
}
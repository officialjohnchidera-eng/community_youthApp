import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FaUsers, FaSearch, FaUserCheck, FaUserTimes, FaClock, FaPhone, FaEnvelope, FaMapMarkerAlt } from 'react-icons/fa'
import DashboardLayout from '../../components/DashboardLayout'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'

export default function MembersPage() {
  const { user } = useAuth()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [selectedMember, setSelectedMember] = useState(null)

  useEffect(() => {
    fetchMembers()
  }, [])

  const fetchMembers = async () => {
    try {
      const res = await api.get('/accounts/members/')
      setMembers(res.data)
    } catch (error) {
      console.log('Members fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const filtered = members
    .filter(m => {
      if (activeTab === 'approved') return m.account_status === 'approved'
      if (activeTab === 'pending') return m.account_status === 'pending'
      if (activeTab === 'executives') return m.role === 'executive'
      return true
    })
    .filter(m => {
      const q = search.toLowerCase()
      return (
        m.first_name?.toLowerCase().includes(q) ||
        m.last_name?.toLowerCase().includes(q) ||
        m.user_id?.toLowerCase().includes(q) ||
        m.village?.name?.toLowerCase().includes(q) ||
        m.position?.title?.toLowerCase().includes(q)
      )
    })

  const approved = members.filter(m => m.account_status === 'approved')
  const pending = members.filter(m => m.account_status === 'pending')
  const executives = members.filter(m => m.role === 'executive')

  const statusColor = (status) => {
    if (status === 'approved') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    if (status === 'pending') return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
    return 'bg-red-500/10 text-red-400 border-red-500/30'
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Members</h1>
          <p className="text-gray-400 text-sm mt-1">View all organization members</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Members', value: members.length, color: 'emerald' },
            { label: 'Approved', value: approved.length, color: 'blue' },
            { label: 'Pending', value: pending.length, color: 'yellow' },
            { label: 'Executives', value: executives.length, color: 'purple' },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="bg-gray-800 border border-gray-700 rounded-2xl p-4 text-center">
              <p className={`text-2xl font-bold ${stat.color === 'emerald' ? 'text-emerald-400' : stat.color === 'blue' ? 'text-blue-400' : stat.color === 'yellow' ? 'text-yellow-400' : 'text-purple-400'}`}>
                {stat.value}
              </p>
              <p className="text-gray-400 text-xs mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, ID, village or position..."
            className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-gray-800 border border-gray-700 rounded-xl p-1 overflow-x-auto">
          {[
            { key: 'all', label: `All (${members.length})` },
            { key: 'approved', label: `Approved (${approved.length})` },
            { key: 'pending', label: `Pending (${pending.length})` },
            { key: 'executives', label: `Executives (${executives.length})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-shrink-0 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.key ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Members Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((member, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedMember(member)}
                className="bg-gray-800 border border-gray-700 rounded-2xl p-5 hover:border-emerald-500/50 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {member.first_name?.[0]}{member.last_name?.[0]}
                  </div>
                  <div className="overflow-hidden flex-1">
                    <p className="text-white font-semibold truncate">{member.first_name} {member.last_name}</p>
                    <p className="text-emerald-400 text-xs">{member.user_id}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${statusColor(member.account_status)}`}>
                    {member.account_status}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {member.village && (
                    <div className="flex items-center gap-2">
                      <FaMapMarkerAlt className="text-gray-500 flex-shrink-0" size={11} />
                      <p className="text-gray-400 text-xs truncate">{member.village.name}</p>
                    </div>
                  )}
                  {member.position && (
                    <div className="flex items-center gap-2">
                      <FaUserCheck className="text-gray-500 flex-shrink-0" size={11} />
                      <p className="text-gray-400 text-xs truncate">{member.position.title}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <FaUsers className="text-gray-500 flex-shrink-0" size={11} />
                    <p className="text-gray-400 text-xs capitalize">{member.role?.replace('_', ' ')}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-gray-800 border border-gray-700 rounded-2xl">
            <FaUsers className="text-gray-600 mx-auto mb-3" size={40} />
            <p className="text-gray-400 font-medium">No members found</p>
          </div>
        )}
      </div>

      {/* Member Detail Modal */}
      {selectedMember && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedMember(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                {selectedMember.first_name?.[0]}{selectedMember.last_name?.[0]}
              </div>
              <div>
                <h3 className="text-white font-bold text-xl">{selectedMember.first_name} {selectedMember.last_name}</h3>
                <p className="text-emerald-400 text-sm">{selectedMember.user_id}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor(selectedMember.account_status)}`}>
                  {selectedMember.account_status}
                </span>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { icon: <FaEnvelope />, label: 'Email', value: selectedMember.email },
                { icon: <FaPhone />, label: 'Phone', value: selectedMember.phone },
                { icon: <FaMapMarkerAlt />, label: 'Village', value: selectedMember.village?.name },
                { icon: <FaUserCheck />, label: 'Position', value: selectedMember.position?.title || 'Floor Member' },
                { icon: <FaUsers />, label: 'Role', value: selectedMember.role?.replace('_', ' ') },
                { icon: <FaClock />, label: 'Joined', value: new Date(selectedMember.date_joined).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 bg-gray-900 rounded-xl p-3">
                  <div className="text-emerald-400 flex-shrink-0">{item.icon}</div>
                  <div>
                    <p className="text-gray-500 text-xs">{item.label}</p>
                    <p className="text-white text-sm">{item.value || 'N/A'}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setSelectedMember(null)}
              className="w-full mt-6 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition-all"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}
    </DashboardLayout>
  )
}
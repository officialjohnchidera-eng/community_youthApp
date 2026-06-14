import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FaPoll, FaPlus, FaTimes, FaCheckCircle, FaClock, FaLock } from 'react-icons/fa'
import DashboardLayout from '../../components/DashboardLayout'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'

export default function PollsPage() {
  const { user } = useAuth()
  const [polls, setPolls] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [voting, setVoting] = useState(null)
  const [activeTab, setActiveTab] = useState('active')
  const [formData, setFormData] = useState({
    question: '',
    deadline: '',
    options: ['', ''],
  })

  const isExecutive = user?.role === 'executive'

  useEffect(() => {
    fetchPolls()
  }, [])

  const fetchPolls = async () => {
    try {
      const res = await api.get('/organization/polls/')
      setPolls(res.data)
    } catch (error) {
      console.log('Polls fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddOption = () => {
    if (formData.options.length < 6) {
      setFormData({ ...formData, options: [...formData.options, ''] })
    }
  }

  const handleRemoveOption = (index) => {
    if (formData.options.length > 2) {
      const newOptions = formData.options.filter((_, i) => i !== index)
      setFormData({ ...formData, options: newOptions })
    }
  }

  const handleOptionChange = (index, value) => {
    const newOptions = [...formData.options]
    newOptions[index] = value
    setFormData({ ...formData, options: newOptions })
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    const filledOptions = formData.options.filter(o => o.trim() !== '')
    if (filledOptions.length < 2) {
      toast.error('Please add at least 2 options')
      return
    }
    setCreating(true)
    try {
      await api.post('/organization/polls/create/', {
        question: formData.question,
        deadline: formData.deadline || null,
        options: filledOptions,
      })
      toast.success('Poll created successfully!')
      setShowCreateModal(false)
      setFormData({ question: '', deadline: '', options: ['', ''] })
      fetchPolls()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create poll')
    } finally {
      setCreating(false)
    }
  }

  const handleVote = async (pollId, optionId) => {
    setVoting(optionId)
    try {
      await api.post(`/organization/polls/${pollId}/vote/`, { option_id: optionId })
      toast.success('Vote recorded!')
      fetchPolls()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to vote')
    } finally {
      setVoting(null)
    }
  }

  const activePolls = polls.filter(p => p.status === 'active')
  const closedPolls = polls.filter(p => p.status === 'closed')

  const getTotalVotes = (poll) => poll.options?.reduce((a, b) => a + (b.vote_count || 0), 0) || 0

  const getPercentage = (voteCount, total) => total === 0 ? 0 : Math.round((voteCount / total) * 100)

  const PollCard = ({ poll }) => {
    const totalVotes = getTotalVotes(poll)
    const isActive = poll.status === 'active'
    const hasVoted = poll.user_has_voted

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800 border border-gray-700 rounded-2xl p-6 hover:border-emerald-500/30 transition-all"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h3 className="text-white font-semibold text-base flex-1">{poll.question}</h3>
          <span className={`text-xs px-3 py-1 rounded-full border flex-shrink-0 ${
            isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-gray-700 text-gray-400 border-gray-600'
          }`}>
            {isActive ? 'Active' : 'Closed'}
          </span>
        </div>

        <div className="space-y-3 mb-4">
          {poll.options?.map((option, i) => {
            const percentage = getPercentage(option.vote_count, totalVotes)
            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-300 text-sm">{option.text}</span>
                  <span className="text-gray-400 text-xs">{option.vote_count} votes ({percentage}%)</span>
                </div>
                <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1 }}
                    className="absolute h-full bg-emerald-500 rounded-full"
                  />
                </div>
                {isActive && !hasVoted && (
                  <button
                    onClick={() => handleVote(poll.id, option.id)}
                    disabled={voting === option.id}
                    className="mt-2 w-full bg-gray-700 hover:bg-emerald-500/20 hover:border-emerald-500/50 border border-gray-600 text-gray-300 hover:text-emerald-400 text-xs py-1.5 rounded-lg transition-all"
                  >
                    {voting === option.id ? 'Voting...' : `Vote for "${option.text}"`}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-700">
          <span>{totalVotes} total votes</span>
          {hasVoted && (
            <span className="text-emerald-400 flex items-center gap-1">
              <FaCheckCircle size={10} /> You voted
            </span>
          )}
          {!isActive && (
            <span className="flex items-center gap-1">
              <FaLock size={10} /> Closed
            </span>
          )}
          {poll.deadline && (
            <span className="flex items-center gap-1">
              <FaClock size={10} /> {new Date(poll.deadline).toLocaleDateString()}
            </span>
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Polls</h1>
            <p className="text-gray-400 text-sm mt-1">Vote on important community decisions</p>
          </div>
          {isExecutive && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all"
            >
              <FaPlus size={12} />
              Create Poll
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Active Polls', value: activePolls.length, color: 'emerald' },
            { label: 'Closed Polls', value: closedPolls.length, color: 'gray' },
          ].map((stat, i) => (
            <div key={i} className="bg-gray-800 border border-gray-700 rounded-2xl p-4 text-center">
              <p className={`text-2xl font-bold ${stat.color === 'emerald' ? 'text-emerald-400' : 'text-gray-400'}`}>
                {stat.value}
              </p>
              <p className="text-gray-400 text-xs mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-gray-800 border border-gray-700 rounded-xl p-1">
          {[
            { key: 'active', label: `Active (${activePolls.length})` },
            { key: 'closed', label: `Closed (${closedPolls.length})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.key ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Polls List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {activeTab === 'active' && (
              activePolls.length > 0 ? activePolls.map((p, i) => <PollCard key={i} poll={p} />) :
              <div className="text-center py-16 bg-gray-800 border border-gray-700 rounded-2xl">
                <FaPoll className="text-gray-600 mx-auto mb-3" size={40} />
                <p className="text-gray-400 font-medium">No active polls</p>
                <p className="text-gray-500 text-sm mt-1">Check back later</p>
              </div>
            )}
            {activeTab === 'closed' && (
              closedPolls.length > 0 ? closedPolls.map((p, i) => <PollCard key={i} poll={p} />) :
              <div className="text-center py-16 bg-gray-800 border border-gray-700 rounded-2xl">
                <FaPoll className="text-gray-600 mx-auto mb-3" size={40} />
                <p className="text-gray-400 font-medium">No closed polls yet</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Poll Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-bold text-lg">Create Poll</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Question</label>
                <textarea
                  value={formData.question}
                  onChange={e => setFormData({ ...formData, question: e.target.value })}
                  placeholder="What would you like to ask?"
                  rows={3}
                  required
                  className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Deadline (optional)</label>
                <input
                  type="datetime-local"
                  value={formData.deadline}
                  onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Options</label>
                <div className="space-y-2">
                  {formData.options.map((option, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={option}
                        onChange={e => handleOptionChange(i, e.target.value)}
                        placeholder={`Option ${i + 1}`}
                        className="flex-1 bg-gray-900 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-2.5 px-4 focus:outline-none focus:border-emerald-500 text-sm"
                      />
                      {formData.options.length > 2 && (
                        <button type="button" onClick={() => handleRemoveOption(i)}
                          className="text-red-400 hover:text-red-300 px-2">
                          <FaTimes size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {formData.options.length < 6 && (
                  <button type="button" onClick={handleAddOption}
                    className="mt-2 text-emerald-400 hover:text-emerald-300 text-xs flex items-center gap-1">
                    <FaPlus size={10} /> Add Option
                  </button>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={creating}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-800 text-white py-3 rounded-xl transition-all font-semibold">
                  {creating ? 'Creating...' : 'Create Poll'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </DashboardLayout>
  )
}
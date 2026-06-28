import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FaUser, FaEnvelope, FaPhone, FaMapMarkerAlt, FaIdCard, FaLock, FaCamera, FaEdit, FaSave, FaTimes, FaShieldAlt } from 'react-icons/fa'
import DashboardLayout from '../../components/DashboardLayout'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'

export default function ProfilePage() {
  const { user, setUser } = useAuth()
  const [editing, setEditing] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
  })
  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  })

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        phone: user.phone || '',
      })
    }
  }, [user])

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api.put('/accounts/profile/update/', formData)
      setUser(res.data.data)
      toast.success('Profile updated successfully!')
      setEditing(false)
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('New passwords do not match')
      return
    }
    if (passwordForm.new_password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setSaving(true)
    try {
      await api.post('/accounts/change-password/', {
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password,
      })
      toast.success('Password changed successfully!')
      setChangingPassword(false)
      setPasswordForm({ old_password: '', new_password: '', confirm_password: '' })
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB')
      return
    }
    setUploadingPhoto(true)
    try {
      const data = new FormData()
      data.append('profile_picture', file)
      const res = await api.put('/accounts/profile/update/', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setUser(res.data.data)
      toast.success('Profile picture updated!')
    } catch (error) {
      toast.error('Failed to upload photo')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const statusColor = (status) => {
    if (status === 'approved') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    if (status === 'pending') return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
    return 'bg-red-500/10 text-red-400 border-red-500/30'
  }

  const initials = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`

  return (
    <DashboardLayout>
      <div className="space-y-4">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-white">My Profile</h1>
          <p className="text-gray-400 text-xs mt-0.5">Manage your personal information</p>
        </div>

        {/* Profile Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800 border border-gray-700 rounded-2xl p-5">
          <div className="flex items-start gap-4">

            {/* Avatar */}
            <div className="relative flex-shrink-0">
              {user?.profile_picture_url ? (
                <img src={user.profile_picture_url} alt="Profile" className="w-20 h-20 rounded-full object-cover border-2 border-emerald-500" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-2xl border-2 border-emerald-600">
                  {initials}
                </div>
              )}
              <label className={`absolute -bottom-1 -right-1 w-7 h-7 bg-gray-700 border border-gray-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-600 transition-all ${uploadingPhoto ? 'opacity-50' : ''}`}>
                {uploadingPhoto ? (
                  <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FaCamera size={10} className="text-gray-300" />
                )}
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={uploadingPhoto} />
              </label>
            </div>

            {/* Basic Info */}
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-bold text-lg">{user?.first_name} {user?.last_name}</h2>
              <p className="text-emerald-400 text-xs font-medium">{user?.user_id}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor(user?.account_status)}`}>
                  {user?.account_status}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full border bg-blue-500/10 text-blue-400 border-blue-500/30">
                  {user?.role?.replace('_', ' ')}
                </span>
                {user?.position && (
                  <span className="text-xs px-2 py-0.5 rounded-full border bg-purple-500/10 text-purple-400 border-purple-500/30">
                    {user.position}
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Personal Information */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-gray-800 border border-gray-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold text-sm">Personal Information</h3>
            {!editing ? (
              <button onClick={() => setEditing(true)}
                className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all">
                <FaEdit size={10} /> Edit
              </button>
            ) : (
              <button onClick={() => setEditing(false)}
                className="text-gray-400 hover:text-white transition-all">
                <FaTimes size={14} />
              </button>
            )}
          </div>

          {!editing ? (
            <div className="space-y-3">
              {[
                { icon: <FaUser size={12} />, label: 'Full Name', value: `${user?.first_name} ${user?.last_name}` },
                { icon: <FaEnvelope size={12} />, label: 'Email', value: user?.email },
                { icon: <FaPhone size={12} />, label: 'Phone', value: user?.phone || 'Not set' },
                { icon: <FaMapMarkerAlt size={12} />, label: 'Village', value: user?.village?.name || user?.village || 'Not set' },
                { icon: <FaIdCard size={12} />, label: 'Member ID', value: user?.user_id },
                { icon: <FaShieldAlt size={12} />, label: 'Date of Birth', value: user?.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not set' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center text-emerald-400 flex-shrink-0">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-500 text-xs">{item.label}</p>
                    <p className="text-white text-sm truncate">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">First Name</label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Last Name</label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Phone Number</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
                <p className="text-yellow-400 text-xs">⚠️ Email, village and position cannot be changed. Contact the President if needed.</p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditing(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-xl text-sm transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-800 text-white py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
                  <FaSave size={12} />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </motion.div>

        {/* Change Password */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-gray-800 border border-gray-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold text-sm">Change Password</h3>
            {!changingPassword ? (
              <button onClick={() => setChangingPassword(true)}
                className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all">
                <FaLock size={10} /> Change
              </button>
            ) : (
              <button onClick={() => setChangingPassword(false)} className="text-gray-400 hover:text-white">
                <FaTimes size={14} />
              </button>
            )}
          </div>

          {!changingPassword ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center text-emerald-400">
                <FaLock size={12} />
              </div>
              <div>
                <p className="text-gray-500 text-xs">Password</p>
                <p className="text-white text-sm">••••••••</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Current Password</label>
                <input
                  type="password"
                  value={passwordForm.old_password}
                  onChange={e => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
                  required
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">New Password</label>
                <input
                  type="password"
                  value={passwordForm.new_password}
                  onChange={e => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  required
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Confirm New Password</label>
                <input
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={e => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                  required
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setChangingPassword(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-xl text-sm transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-800 text-white py-2.5 rounded-xl text-sm font-semibold transition-all">
                  {saving ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </form>
          )}
        </motion.div>

        {/* Account Info */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-gray-800 border border-gray-700 rounded-2xl p-5">
          <h3 className="text-white font-semibold text-sm mb-4">Account Information</h3>
          <div className="space-y-3">
            {[
              { label: 'Member Since', value: user?.date_joined ? new Date(user.date_joined).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A' },
              { label: 'Account Status', value: user?.account_status },
              { label: 'Role', value: user?.role?.replace('_', ' ') },
              { label: 'Position', value: user?.position || 'Floor Member' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <p className="text-gray-500 text-xs">{item.label}</p>
                <p className="text-white text-xs font-medium">{item.value}</p>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </DashboardLayout>
  )
}
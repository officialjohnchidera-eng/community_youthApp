import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FaPhotoVideo, FaPlus, FaTimes, FaTrash, FaPlay, FaImage, FaVideo, FaLock, FaGlobe } from 'react-icons/fa'
import DashboardLayout from '../../components/DashboardLayout'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'

export default function MediaPage() {
  const { user } = useAuth()
  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(true)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [selectedMedia, setSelectedMedia] = useState(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    media_type: 'photo',
    is_public: false,
  })
  const [file, setFile] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  const isPro = user?.position?.title && 
    ['Public Relation Officer', 'General President', 'Vice President'].includes(user.position.title)

  useEffect(() => {
    fetchMedia()
  }, [])

  const fetchMedia = async () => {
    try {
      const res = await api.get('/organization/media/')
      setMedia(res.data)
    } catch (error) {
      console.log('Media fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) {
      toast.error('Please select a file')
      return
    }
    setUploading(true)
    setUploadProgress(0)
    try {
      const data = new FormData()
      data.append('title', formData.title)
      data.append('description', formData.description)
      data.append('media_type', formData.media_type)
      data.append('is_public', formData.is_public ? 'true' : 'false')
      data.append('file', file)

      await api.post('/organization/media/upload/', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setUploadProgress(progress)
        }
      })

      toast.success('Media uploaded successfully!')
      setShowUploadModal(false)
      setFormData({ title: '', description: '', media_type: 'photo', is_public: false })
      setFile(null)
      setUploadProgress(0)
      fetchMedia()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (mediaId) => {
    if (!window.confirm('Are you sure you want to delete this media?')) return
    try {
      await api.delete(`/organization/media/${mediaId}/delete/`)
      toast.success('Media deleted!')
      fetchMedia()
    } catch (error) {
      toast.error('Failed to delete media')
    }
  }

  const photos = media.filter(m => m.media_type === 'photo')
  const videos = media.filter(m => m.media_type === 'video')
  const publicMedia = media.filter(m => m.is_public)
  const privateMedia = media.filter(m => !m.is_public)

  const filtered = activeTab === 'all' ? media :
    activeTab === 'photos' ? photos :
    activeTab === 'videos' ? videos :
    activeTab === 'public' ? publicMedia : privateMedia

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Media Gallery</h1>
            <p className="text-gray-400 text-sm mt-1">Photos and videos from our activities</p>
          </div>
          {isPro && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all"
            >
              <FaPlus size={12} />
              Upload Media
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Media', value: media.length, icon: <FaPhotoVideo />, color: 'emerald' },
            { label: 'Photos', value: photos.length, icon: <FaImage />, color: 'blue' },
            { label: 'Videos', value: videos.length, icon: <FaVideo />, color: 'purple' },
            { label: 'Public', value: publicMedia.length, icon: <FaGlobe />, color: 'yellow' },
          ].map((stat, i) => (
            <div key={i} className="bg-gray-800 border border-gray-700 rounded-2xl p-4">
              <div className={`text-xl mb-2 ${stat.color === 'emerald' ? 'text-emerald-400' : stat.color === 'blue' ? 'text-blue-400' : stat.color === 'purple' ? 'text-purple-400' : 'text-yellow-400'}`}>
                {stat.icon}
              </div>
              <p className={`text-2xl font-bold ${stat.color === 'emerald' ? 'text-emerald-400' : stat.color === 'blue' ? 'text-blue-400' : stat.color === 'purple' ? 'text-purple-400' : 'text-yellow-400'}`}>
                {stat.value}
              </p>
              <p className="text-gray-400 text-xs mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-gray-800 border border-gray-700 rounded-xl p-1 overflow-x-auto">
          {[
            { key: 'all', label: `All (${media.length})` },
            { key: 'photos', label: `Photos (${photos.length})` },
            { key: 'videos', label: `Videos (${videos.length})` },
            { key: 'public', label: `Public (${publicMedia.length})` },
            { key: 'private', label: `Private (${privateMedia.length})` },
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

        {/* Media Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="relative group rounded-2xl overflow-hidden border border-gray-700 hover:border-emerald-500/50 transition-all cursor-pointer"
                onClick={() => setSelectedMedia(item)}
              >
                {item.media_type === 'photo' ? (
                  <img src={item.file_url} alt={item.title} className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="relative">
                    <video src={item.file_url} className="w-full h-40 object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <div className="w-10 h-10 bg-emerald-500/90 rounded-full flex items-center justify-center">
                        <FaPlay className="text-white ml-0.5" size={14} />
                      </div>
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white text-xs font-medium truncate">{item.title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-xs flex items-center gap-1 ${item.is_public ? 'text-emerald-400' : 'text-gray-400'}`}>
                        {item.is_public ? <><FaGlobe size={8} /> Public</> : <><FaLock size={8} /> Private</>}
                      </span>
                      {isPro && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          <FaTrash size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-gray-800 border border-gray-700 rounded-2xl">
            <FaPhotoVideo className="text-gray-600 mx-auto mb-3" size={40} />
            <p className="text-gray-400 font-medium">No media yet</p>
            <p className="text-gray-500 text-sm mt-1">
              {isPro ? 'Upload photos and videos from your activities' : 'No media has been uploaded yet'}
            </p>
          </div>
        )}
      </div>

      {/* Media Viewer Modal */}
      {selectedMedia && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setSelectedMedia(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative max-w-4xl w-full"
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => setSelectedMedia(null)} className="absolute -top-10 right-0 text-white hover:text-gray-300">
              <FaTimes size={24} />
            </button>
            {selectedMedia.media_type === 'photo' ? (
              <img src={selectedMedia.file_url} alt={selectedMedia.title} className="w-full rounded-2xl max-h-[80vh] object-contain" />
            ) : (
              <video src={selectedMedia.file_url} controls autoPlay className="w-full rounded-2xl max-h-[80vh]" />
            )}
            <div className="mt-4 text-center">
              <p className="text-white font-semibold">{selectedMedia.title}</p>
              {selectedMedia.description && <p className="text-gray-400 text-sm mt-1">{selectedMedia.description}</p>}
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className={`text-xs flex items-center gap-1 ${selectedMedia.is_public ? 'text-emerald-400' : 'text-gray-400'}`}>
                  {selectedMedia.is_public ? <><FaGlobe size={10} /> Public</> : <><FaLock size={10} /> Private</>}
                </span>
                <span className="text-gray-600 text-xs">•</span>
                <span className="text-gray-400 text-xs">{new Date(selectedMedia.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-bold text-lg">Upload Media</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-white">
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Community Road Clearing"
                  required
                  className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Media Type</label>
                <select
                  value={formData.media_type}
                  onChange={e => setFormData({ ...formData, media_type: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500"
                >
                  <option value="photo">Photo</option>
                  <option value="video">Video</option>
                </select>
              </div>
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Description (optional)</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description..."
                  rows={2}
                  className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">File</label>
                <input
                  type="file"
                  accept={formData.media_type === 'photo' ? 'image/*' : 'video/*'}
                  onChange={e => setFile(e.target.files[0])}
                  required
                  className="w-full bg-gray-900 border border-gray-700 text-gray-400 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-500 file:text-white file:text-xs"
                />
              </div>
              <div className="flex items-center gap-3 bg-gray-900 rounded-xl p-3 border border-gray-700">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={formData.is_public}
                  onChange={e => setFormData({ ...formData, is_public: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500"
                />
                <div>
                  <label htmlFor="isPublic" className="text-white text-sm font-medium cursor-pointer">Make Public</label>
                  <p className="text-gray-500 text-xs">Public media appears on the landing page for visitors</p>
                </div>
              </div>

              {uploading && (
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      animate={{ width: `${uploadProgress}%` }}
                      className="h-full bg-emerald-500 rounded-full"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowUploadModal(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={uploading}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-800 text-white py-3 rounded-xl transition-all font-semibold">
                  {uploading ? `Uploading ${uploadProgress}%` : 'Upload'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </DashboardLayout>
  )
}
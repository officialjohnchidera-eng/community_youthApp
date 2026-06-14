import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { FaFileAlt, FaPlus, FaTimes, FaDownload, FaFilePdf, FaFileWord, FaFileImage, FaFile, FaSearch } from "react-icons/fa"
import DashboardLayout from "../../components/DashboardLayout"
import api from "../../api/axios"
import toast from "react-hot-toast"
import { useAuth } from "../../context/AuthContext"

export default function DocumentsPage() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState("")
  const [formData, setFormData] = useState({ title: "", description: "", document_type: "minutes" })
  const [file, setFile] = useState(null)

  const isSecretary = user?.position &&
    ["General Secretary", "Assistant Secretary", "General President", "Vice President"].includes(user.position)

  useEffect(() => { fetchDocuments() }, [])

  const fetchDocuments = async () => {
    try {
      const res = await api.get("/organization/documents/")
      setDocuments(res.data)
    } catch (error) {
      console.log("Documents fetch error:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) { toast.error("Please select a file"); return }
    setUploading(true)
    try {
      const data = new FormData()
      data.append("title", formData.title)
      data.append("description", formData.description)
      data.append("document_type", formData.document_type)
      data.append("file", file)
      await api.post("/organization/documents/upload/", data, { headers: { "Content-Type": "multipart/form-data" } })
      toast.success("Document uploaded successfully!")
      setShowUploadModal(false)
      setFormData({ title: "", description: "", document_type: "minutes" })
      setFile(null)
      fetchDocuments()
    } catch (error) {
      toast.error(error.response?.data?.error || "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const getFileIcon = (url) => {
    if (!url) return <FaFile className="text-gray-400" />
    if (url.includes(".pdf")) return <FaFilePdf className="text-red-400" />
    if (url.includes(".doc")) return <FaFileWord className="text-blue-400" />
    if (url.match(/\.(jpg|jpeg|png|gif)/)) return <FaFileImage className="text-emerald-400" />
    return <FaFileAlt className="text-gray-400" />
  }

  const typeColor = (type) => {
    if (type === "minutes") return "bg-blue-500/10 text-blue-400 border-blue-500/30"
    if (type === "constitution") return "bg-purple-500/10 text-purple-400 border-purple-500/30"
    if (type === "financial") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
    if (type === "notice") return "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
    return "bg-gray-500/10 text-gray-400 border-gray-500/30"
  }

  const filtered = documents.filter(d =>
    d.title?.toLowerCase().includes(search.toLowerCase()) ||
    d.document_type?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <DashboardLayout>
      <div className="space-y-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-white">Documents</h1>
            <p className="text-gray-400 text-xs mt-0.5">Official organization documents and files</p>
          </div>
          {isSecretary && (
            <button onClick={() => setShowUploadModal(true)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1 transition-all flex-shrink-0 whitespace-nowrap">
              <FaPlus size={9} />
              Upload Doc
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Total Documents", value: documents.length, color: "emerald" },
            { label: "Minutes", value: documents.filter(d => d.document_type === "minutes").length, color: "blue" },
            { label: "Financial", value: documents.filter(d => d.document_type === "financial").length, color: "yellow" },
            { label: "Other", value: documents.filter(d => !["minutes", "financial"].includes(d.document_type)).length, color: "purple" },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-gray-800 border border-gray-700 rounded-2xl p-3">
              <p className={`text-xl font-bold ${stat.color === "emerald" ? "text-emerald-400" : stat.color === "blue" ? "text-blue-400" : stat.color === "yellow" ? "text-yellow-400" : "text-purple-400"}`}>{stat.value}</p>
              <p className="text-gray-400 text-xs mt-0.5">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={12} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents..." className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500" />
        </div>

        {/* Documents List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((doc, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-gray-800 border border-gray-700 rounded-2xl p-3 hover:border-emerald-500/30 transition-all flex items-center gap-3 w-full overflow-hidden">
                <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center flex-shrink-0 text-xl">
                  {getFileIcon(doc.file_url)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-semibold text-sm truncate">{doc.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${typeColor(doc.document_type)}`}>{doc.document_type}</span>
                  </div>
                  {doc.description && <p className="text-gray-400 text-xs mt-0.5 truncate">{doc.description}</p>}
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <p className="text-gray-500 text-xs">By {doc.uploaded_by}</p>
                    <p className="text-gray-500 text-xs">{new Date(doc.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                </div>
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                  className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 p-2.5 rounded-xl transition-all flex-shrink-0">
                  <FaDownload size={12} />
                </a>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-gray-800 border border-gray-700 rounded-2xl">
            <FaFileAlt className="text-gray-600 mx-auto mb-3" size={40} />
            <p className="text-gray-400 font-medium">No documents yet</p>
            <p className="text-gray-500 text-sm mt-1">{isSecretary ? "Upload official documents for members to access" : "No documents have been uploaded yet"}</p>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800 border border-gray-700 rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-bold text-lg">Upload Document</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-white"><FaTimes /></button>
            </div>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Title</label>
                <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="Document title" required className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Document Type</label>
                <select value={formData.document_type} onChange={e => setFormData({ ...formData, document_type: e.target.value })} className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500">
                  <option value="minutes">Meeting Minutes</option>
                  <option value="constitution">Constitution</option>
                  <option value="financial">Financial Report</option>
                  <option value="notice">Notice</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Description (optional)</label>
                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Brief description..." rows={2} className="w-full bg-gray-900 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 resize-none" />
              </div>
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">File</label>
                <input type="file" onChange={e => setFile(e.target.files[0])} required className="w-full bg-gray-900 border border-gray-700 text-gray-400 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-500 file:text-white file:text-xs" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowUploadModal(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition-all">Cancel</button>
                <button type="submit" disabled={uploading} className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-800 text-white py-3 rounded-xl transition-all font-semibold">{uploading ? "Uploading..." : "Upload"}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </DashboardLayout>
  )
}
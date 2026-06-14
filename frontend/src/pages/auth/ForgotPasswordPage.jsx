import { useState } from "react"
import { motion } from "framer-motion"
import { FaEnvelope, FaArrowLeft } from "react-icons/fa"
import { Link } from "react-router-dom"
import api from "../../api/axios"
import toast from "react-hot-toast"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post("/accounts/forgot-password/", { email })
      setSent(true)
      toast.success("Reset link sent!")
    } catch (error) {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/src/assets/leopard.jpg" alt="Logo" className="w-16 h-16 rounded-2xl mx-auto mb-4 object-cover" />
          <h1 className="text-white font-bold text-xl">Umuagu Youth Association</h1>
          <p className="text-gray-400 text-sm mt-1">Password Recovery</p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8">
          {!sent ? (
            <>
              <h2 className="text-white font-bold text-lg mb-2">Forgot Password?</h2>
              <p className="text-gray-400 text-sm mb-6">Enter your email address and we'll send you a link to reset your password.</p>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-gray-300 text-sm font-medium mb-2 block">Email Address</label>
                  <div className="relative">
                    <FaEnvelope className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="Enter your email"
                      className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-800 text-white py-3 rounded-xl font-semibold transition-all"
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
            </>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-4">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <FaEnvelope className="text-emerald-400" size={24} />
              </div>
              <h2 className="text-white font-bold text-lg mb-2">Check Your Email!</h2>
              <p className="text-gray-400 text-sm mb-2">We sent a password reset link to:</p>
              <p className="text-emerald-400 font-medium text-sm mb-4">{email}</p>
              <p className="text-gray-500 text-xs">The link expires in 1 hour. Check your spam folder if you don't see it.</p>
            </motion.div>
          )}

          <div className="mt-6 text-center">
            <Link to="/login" className="text-gray-400 hover:text-emerald-400 text-sm flex items-center justify-center gap-2 transition-all">
              <FaArrowLeft size={12} />
              Back to Login
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
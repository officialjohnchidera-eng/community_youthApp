import { useState } from "react"
import { motion } from "framer-motion"
import { FaLock, FaEye, FaEyeSlash, FaArrowLeft, FaCheckCircle } from "react-icons/fa"
import { Link, useSearchParams, useNavigate } from "react-router-dom"
import api from "../../api/axios"
import toast from "react-hot-toast"

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get("token")

  const [formData, setFormData] = useState({ new_password: "", confirm_password: "" })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (formData.new_password !== formData.confirm_password) {
      toast.error("Passwords do not match!")
      return
    }
    if (formData.new_password.length < 8) {
      toast.error("Password must be at least 8 characters.")
      return
    }
    setLoading(true)
    try {
      await api.post("/accounts/reset-password/", { ...formData, token })
      setSuccess(true)
      toast.success("Password reset successful!")
      setTimeout(() => navigate("/login"), 3000)
    } catch (error) {
      const msg = error.response?.data?.error
      toast.error(msg || "Reset failed. Link may have expired.")
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 font-semibold">Invalid reset link.</p>
          <Link to="/forgot-password" className="text-emerald-400 text-sm mt-2 block">Request a new one</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/src/assets/leopard.jpg" alt="Logo" className="w-16 h-16 rounded-2xl mx-auto mb-4 object-cover" />
          <h1 className="text-white font-bold text-xl">Umuagu Youth Association</h1>
          <p className="text-gray-400 text-sm mt-1">Reset Your Password</p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8">
          {!success ? (
            <>
              <h2 className="text-white font-bold text-lg mb-2">Set New Password</h2>
              <p className="text-gray-400 text-sm mb-6">Choose a strong password for your account.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-gray-300 text-sm font-medium mb-2 block">New Password</label>
                  <div className="relative">
                    <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.new_password}
                      onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                      required
                      placeholder="Min. 8 characters"
                      className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3 pl-11 pr-11 focus:outline-none focus:border-emerald-500"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                      {showPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-gray-300 text-sm font-medium mb-2 block">Confirm Password</label>
                  <div className="relative">
                    <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.confirm_password}
                      onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                      required
                      placeholder="Confirm your password"
                      className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {formData.new_password && (
                  <div className="space-y-1">
                    {[
                      { check: formData.new_password.length >= 8, label: "At least 8 characters" },
                      { check: /[A-Z]/.test(formData.new_password), label: "One uppercase letter" },
                      { check: /[0-9]/.test(formData.new_password), label: "One number" },
                    ].map((rule, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${rule.check ? "bg-emerald-400" : "bg-gray-600"}`}></div>
                        <span className={`text-xs ${rule.check ? "text-emerald-400" : "text-gray-500"}`}>{rule.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-800 text-white py-3 rounded-xl font-semibold transition-all"
                >
                  {loading ? "Resetting..." : "Reset Password"}
                </button>
              </form>
            </>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-4">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <FaCheckCircle className="text-emerald-400" size={24} />
              </div>
              <h2 className="text-white font-bold text-lg mb-2">Password Reset!</h2>
              <p className="text-gray-400 text-sm">Your password has been reset successfully. Redirecting to login...</p>
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
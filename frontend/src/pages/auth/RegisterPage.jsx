import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FaEye, FaEyeSlash, FaUser, FaEnvelope, FaPhone, FaLock } from 'react-icons/fa'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import leopard from '../../assets/leopard.jpg'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    village: '',
    position: '',
    role: 'floor_member',
    password: '',
    confirm_password: '',
  })
  const [villages, setVillages] = useState([])
  const [positions, setPositions] = useState([])
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/accounts/villages/').then(res => setVillages(res.data))
    api.get('/accounts/positions/').then(res => setPositions(res.data))
  }, [])

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleNext = (e) => {
    e.preventDefault()
    if (!formData.first_name || !formData.last_name || !formData.email || !formData.phone || !formData.date_of_birth) {
      toast.error('Please fill in all fields')
      return
    }
    setStep(2)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (formData.password !== formData.confirm_password) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const payload = {
        ...formData,
        village: parseInt(formData.village),
        position: formData.position ? parseInt(formData.position) : null,
      }
      const res = await api.post('/accounts/register/', payload)
      toast.success(`Registration successful! Your User ID is ${res.data.user_id}`)
      setTimeout(() => navigate('/login'), 3000)
    } catch (error) {
      const errors = error.response?.data
      if (errors) {
        const firstError = Object.values(errors)[0]
        toast.error(Array.isArray(firstError) ? firstError[0] : firstError)
      } else {
        toast.error('Registration failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex">

      {/* Left Side — Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img src={leopard} alt="Umuagu Youth" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gray-900/75"></div>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <img src={leopard} alt="Logo" className="w-20 h-20 rounded-full object-cover border-4 border-emerald-500 mx-auto mb-6 shadow-xl" />
            <h1 className="text-4xl font-bold text-white mb-4">Join Umuagu Youth</h1>
            <p className="text-emerald-400 text-lg font-medium mb-6">General Youth Association</p>
            <p className="text-gray-300 text-base leading-relaxed max-w-md">
              Become part of a strong and united community. Register today and connect with members across all 4 village units.
            </p>
            <div className="mt-10 space-y-4 text-left max-w-sm mx-auto">
              {[
                '✅ Access to member dashboard',
                '✅ Pay dues and contributions online',
                '✅ Stay updated with announcements',
                '✅ Participate in polls and decisions',
                '✅ Track welfare and empowerment programs',
              ].map((item, i) => (
                <p key={i} className="text-gray-300 text-sm">{item}</p>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Side — Register Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img src={leopard} alt="Logo" className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500" />
            <div>
              <h1 className="text-white font-bold text-lg leading-none">Umuagu Youth</h1>
              <p className="text-emerald-400 text-xs">General Association</p>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-white mb-2">Create Account</h2>
          <p className="text-gray-400 mb-6">Step {step} of 2 — {step === 1 ? 'Personal Information' : 'Account Setup'}</p>

          {/* Step Indicator */}
          <div className="flex gap-2 mb-8">
            <div className="flex-1 h-1.5 rounded-full bg-emerald-500"></div>
            <div className={`flex-1 h-1.5 rounded-full ${step === 2 ? 'bg-emerald-500' : 'bg-gray-700'}`}></div>
          </div>

          {/* Step 1 */}
          {step === 1 && (
            <form onSubmit={handleNext} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-300 text-sm font-medium mb-2 block">First Name</label>
                  <div className="relative">
                    <FaUser className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                    <input
                      type="text"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleChange}
                      placeholder="First name"
                      required
                      className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-gray-300 text-sm font-medium mb-2 block">Last Name</label>
                  <div className="relative">
                    <FaUser className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                    <input
                      type="text"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleChange}
                      placeholder="Last name"
                      required
                      className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Email Address</label>
                <div className="relative">
                  <FaEnvelope className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Enter your email"
                    required
                    className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Phone Number</label>
                <div className="relative">
                  <FaPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="08012345678"
                    required
                    className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Date of Birth</label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleChange}
                  required
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl transition-all transform hover:scale-105 shadow-lg shadow-emerald-500/25"
              >
                Next Step →
              </button>
            </form>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Village Unit</label>
                <select
                  name="village"
                  value={formData.village}
                  onChange={handleChange}
                  required
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="">Select your village</option>
                  {villages.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Role</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="floor_member">Floor Member</option>
                  <option value="executive">Executive</option>
                </select>
              </div>

              {formData.role === 'executive' && (
                <div>
                  <label className="text-gray-300 text-sm font-medium mb-2 block">Position</label>
                  <select
                    name="position"
                    value={formData.position}
                    onChange={handleChange}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="">Select your position</option>
                    {positions.filter(p => !p.is_occupied).map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Password</label>
                <div className="relative">
                  <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Create a password"
                    required
                    className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 pl-11 pr-12 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                    {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">Confirm Password</label>
                <div className="relative">
                  <FaLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirm_password"
                    value={formData.confirm_password}
                    onChange={handleChange}
                    placeholder="Confirm your password"
                    required
                    className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 pl-11 pr-12 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                    {showConfirmPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-xl transition-all border border-gray-700"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all transform hover:scale-105 shadow-lg shadow-emerald-500/25"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Registering...
                    </div>
                  ) : 'Register'}
                </button>
              </div>
            </form>
          )}

          <p className="text-center text-gray-400 mt-8">
            Already have an account?{' '}
            <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
              Login here
            </Link>
          </p>
          <p className="text-center mt-4">
            <Link to="/" className="text-gray-600 hover:text-gray-400 text-sm transition-colors">
              ← Back to Home
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
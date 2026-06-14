import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FaEye, FaEyeSlash, FaLock, FaEnvelope } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import leopard from "../../assets/leopard.jpg";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (error) {
      const message =
        error.response?.data?.detail || "Invalid email or password.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Left Side — Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src={leopard}
          alt="Umuagu Youth"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gray-900/70"></div>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <img
              src={leopard}
              alt="Logo"
              className="w-20 h-20 rounded-full object-cover border-4 border-emerald-500 mx-auto mb-6 shadow-xl"
            />
            <h1 className="text-4xl font-bold text-white mb-4">Community Youth</h1>
            <p className="text-emerald-400 text-lg font-medium mb-6">
              General Youth Organization
            </p>
            <p className="text-gray-300 text-base leading-relaxed max-w-md">
              One platform for all 4 village units. Manage payments, meetings,
              welfare and community development seamlessly.
            </p>
            <div className="mt-10 grid grid-cols-3 gap-6 text-center">
              {[
                { value: "4", label: "Villages" },
                { value: "150+", label: "Members" },
                { value: "13", label: "Executives" },
              ].map((stat, i) => (
                <div key={i}>
                  <p className="text-2xl font-bold text-emerald-400">
                    {stat.value}
                  </p>
                  <p className="text-gray-400 text-sm">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Side — Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img
              src={leopard}
              alt="Logo"
              className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500"
            />
            <div>
              <h1 className="text-white font-bold text-lg leading-none">
                Community Youth
              </h1>
              <p className="text-emerald-400 text-xs">Association</p>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2>
          <p className="text-gray-400 mb-8">
            Sign in to your account to continue
          </p>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label className="text-gray-300 text-sm font-medium mb-2 block">
                Email Address
              </label>
              <div className="relative">
                <FaEnvelope
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                  size={16}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-gray-300 text-sm font-medium mb-2 block">
                Password
              </label>
              <div className="relative">
                <FaLock
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                  size={16}
                />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl py-3 pl-11 pr-12 focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? (
                    <FaEyeSlash size={16} />
                  ) : (
                    <FaEye size={16} />
                  )}
                </button>
              </div>
            </div>

            {/* Forgot Password */}
            <div className="text-right">
              <Link
                to="/forgot-password"
                className="text-emerald-400 hover:text-emerald-300 text-xs transition-all"
              >
                Forgot Password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all transform hover:scale-105 shadow-lg shadow-emerald-500/25"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Signing in...
                </div>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Register Link */}
          <p className="text-center text-gray-400 mt-8">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
            >
              Register here
            </Link>
          </p>

          {/* Back to Home */}
          <p className="text-center mt-4">
            <Link
              to="/"
              className="text-gray-600 hover:text-gray-400 text-sm transition-colors"
            >
              ← Back to Home
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

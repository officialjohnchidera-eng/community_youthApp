import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import {
  FaShieldAlt,
  FaUsers,
  FaMoneyBillWave,
  FaCalendarAlt,
  FaBullhorn,
  FaChartBar,
  FaChevronLeft,
  FaChevronRight,
  FaPlay,
  FaHistory,
} from "react-icons/fa";

import leopard from "../assets/leopard.jpg";
import slide from "../assets/slide.jpg";
import slide2 from "../assets/slide2.jpg";
import slide3 from "../assets/slide3.jpg";
import slide4 from "../assets/slide4.jpg";
import axios from "axios";

const slides = [slide, slide2, slide3, slide4];

const features = [
  {
    icon: <FaUsers size={28} />,
    title: "Member Management",
    description:
      "Seamlessly manage all members across the 4 village units with role-based access control.",
  },
  {
    icon: <FaMoneyBillWave size={28} />,
    title: "Payment System",
    description:
      "Collect monthly dues and event contributions securely via Paystack with automatic receipts.",
  },
  {
    icon: <FaCalendarAlt size={28} />,
    title: "Meetings & Activities",
    description:
      "Schedule meetings, track attendance, log expenditures and record minutes all in one place.",
  },
  {
    icon: <FaBullhorn size={28} />,
    title: "Announcements",
    description:
      "Keep all members informed with instant announcements, notices and push notifications.",
  },
  {
    icon: <FaChartBar size={28} />,
    title: "Financial Reports",
    description:
      "Track all income and expenditures with detailed financial reports and payment history.",
  },
  {
    icon: <FaShieldAlt size={28} />,
    title: "Secure & Reliable",
    description:
      "Bank-grade security with JWT authentication, role-based permissions and audit trails.",
  },
];

export default function LandingPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [publicMedia, setPublicMedia] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_API_URL}/organization/media/public/`)
      .then((res) => {
        setPublicMedia(res.data);
      })
      .catch((err) => {
        console.log("Media fetch error:", err);
      });
  }, []);

  const prevSlide = () =>
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={leopard}
                alt="Umuagu Youth Logo"
                className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shadow-lg shadow-emerald-500/30"
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-gray-900"></div>
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-none">
                Umuagu Youth
              </h1>
              <p className="text-emerald-400 text-xs font-medium tracking-wider uppercase">
                General Association
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="#history"
              className="text-gray-300 hover:text-emerald-400 text-sm font-medium transition-colors hidden md:block"
            >
              History
            </a>
            <a
              href="#activities"
              className="text-gray-300 hover:text-emerald-400 text-sm font-medium transition-colors hidden md:block"
            >
              Activities
            </a>

            <Link
              to="/login"
              className="border border-emerald-500/50 hover:border-emerald-400 text-emerald-400 hover:text-emerald-300 text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shadow-lg shadow-emerald-500/25"
            >
              Join Now
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 relative h-screen overflow-hidden">
        {slides.map((slideImg, i) => (
          <div
            key={i}
            className={`absolute inset-0 transition-opacity duration-1000 ${i === currentSlide ? "opacity-100" : "opacity-0"}`}
          >
            <img
              src={slideImg}
              alt={`Slide ${i + 1}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gray-900/70"></div>
          </div>
        ))}

        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              One Platform for{" "}
              <span className="text-emerald-400">Our Community</span>
            </h1>
            <p className="text-gray-300 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
              Bringing together all 4 village units of our Community under one powerful
              digital platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-8 py-4 rounded-xl transition-all transform hover:scale-105 shadow-lg shadow-emerald-500/25"
              >
                Join the Association
              </Link>
              <a
                href="#history"
                className="bg-white/10 hover:bg-white/20 backdrop-blur text-white font-semibold px-8 py-4 rounded-xl transition-all border border-white/20 flex items-center gap-2 justify-center"
              >
                <FaHistory size={16} />
                Our History
              </a>
            </div>
          </motion.div>
        </div>

        <button
          onClick={prevSlide}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-black/40 hover:bg-black/60 text-white p-3 rounded-full transition-all"
        >
          <FaChevronLeft />
        </button>
        <button
          onClick={nextSlide}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-black/40 hover:bg-black/60 text-white p-3 rounded-full transition-all"
        >
          <FaChevronRight />
        </button>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`h-2 rounded-full transition-all ${i === currentSlide ? "bg-emerald-400 w-6" : "bg-white/50 w-2"}`}
            />
          ))}
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 px-4 border-y border-gray-800 bg-gray-800/30">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "4", label: "Village Units" },
            { value: "150+", label: "Members" },
            { value: "13", label: "Executive Positions" },
            { value: "100%", label: "Secure" },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <p className="text-3xl md:text-4xl font-bold text-emerald-400">
                {stat.value}
              </p>
              <p className="text-gray-400 text-sm mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Everything You Need
            </h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              A complete platform built specifically for the Umuagu Youth
              Association
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-gray-800 border border-gray-700 rounded-2xl p-6 hover:border-emerald-500/50 transition-all hover:shadow-lg hover:shadow-emerald-500/10"
              >
                <div className="text-emerald-400 mb-4">{feature.icon}</div>
                <h3 className="text-white font-semibold text-lg mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Work Activities Section */}
      <section id="activities" className="py-20 px-4 bg-gray-800/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Our Work Activities
            </h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              See what the Youth's are doing to develop and strengthen our
              community
            </p>
          </div>

          {publicMedia.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {publicMedia.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.15 }}
                  className="relative rounded-2xl overflow-hidden group border border-gray-700 hover:border-emerald-500/50 transition-all"
                >
                  {item.media_type === "video" ? (
                    <video
                      src={item.file_url}
                      className="w-full h-56 object-cover"
                      controls
                      preload="metadata"
                      playsInline
                    />
                  ) : (
                    <img
                      src={item.file_url}
                      alt={item.title}
                      className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  )}
                  <div className="p-4 bg-gray-800">
                    <p className="text-white font-semibold text-sm">
                      {item.title}
                    </p>
                    <p className="text-emerald-400 text-xs mt-1">
                      {new Date(item.created_at).toLocaleDateString("en-GB", {
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  src: new URL("../assets/video1.mp4", import.meta.url).href,
                  title: "Community Road Clearing",
                  date: "January 2026",
                },
                {
                  src: new URL("../assets/video2.mp4", import.meta.url).href,
                  title: "Youth Empowerment Program",
                  date: "December 2025",
                },
                {
                  src: new URL("../assets/video3.mp4", import.meta.url).href,
                  title: "Community Clean Up Drive",
                  date: "November 2025",
                },
                {
                  src: new URL("../assets/video4.mp4", import.meta.url).href,
                  title: "Village Development Project",
                  date: "October 2025",
                },
              ].map((video, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.15 }}
                  className="relative rounded-2xl overflow-hidden group border border-gray-700 hover:border-emerald-500/50 transition-all"
                >
                  <video
                    src={video.src}
                    className="w-full h-56 object-cover"
                    controls
                    preload="metadata"
                    playsInline
                  />
                  <div className="p-4 bg-gray-800">
                    <p className="text-white font-semibold text-sm">
                      {video.title}
                    </p>
                    <p className="text-emerald-400 text-xs mt-1">
                      {video.date}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* History Section */}
      <section id="history" className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Our History
            </h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              The journey of the Umuagu General Youth Association through the
              years
            </p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 mb-12">
            <div className="flex items-center gap-4 mb-6">
              <img
                src={leopard}
                alt="Logo"
                className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500"
              />
              <div>
                <h3 className="text-white font-bold text-xl">
                  Community General Youth Association
                </h3>
                <p className="text-emerald-400 text-sm">
                  A Legacy of Unity and Community Development
                </p>
              </div>
            </div>
            <p className="text-gray-400 leading-relaxed">
              [ This section will be updated with the official history of the
              Community General Youth Association as provided by the chairman. ]
            </p>
          </div>
          <div className="relative">
            <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 bg-emerald-500/30 -translate-x-1/2"></div>
            <div className="space-y-10">
              {[
                {
                  year: "[ YEAR ]",
                  title: "Organization Founded",
                  description:
                    "The Community General Youth Association was established with the vision of uniting all youth across the 4 village units.",
                },
                {
                  year: "[ YEAR ]",
                  title: "First General Meeting",
                  description:
                    "The inaugural general meeting was held, bringing together youth leaders from all villages to set the foundation.",
                },
                {
                  year: "[ YEAR ]",
                  title: "Executive Structure Established",
                  description:
                    "A formal executive structure with 13 positions was created to ensure effective governance and representation.",
                },
                {
                  year: "[ YEAR ]",
                  title: "Community Development Initiative",
                  description:
                    "Launch of major community development projects including road clearing, welfare programs and youth empowerment.",
                },
                {
                  year: "2026",
                  title: "Digital Transformation",
                  description:
                    "Launch of the Community Youth digital platform to modernize operations and improve communication across all villages.",
                },
              ].map((milestone, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`relative flex flex-col md:flex-row gap-6 ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"}`}
                >
                  <div className="absolute left-4 md:left-1/2 w-4 h-4 bg-emerald-500 rounded-full -translate-x-1/2 mt-1 border-2 border-gray-900 z-10"></div>
                  <div
                    className={`ml-12 md:ml-0 md:w-1/2 ${i % 2 === 0 ? "md:pr-12" : "md:pl-12"}`}
                  >
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 hover:border-emerald-500/50 transition-all">
                      <span className="text-emerald-400 font-bold text-lg">
                        {milestone.year}
                      </span>
                      <h3 className="text-white font-semibold text-lg mt-1 mb-2">
                        {milestone.title}
                      </h3>
                      <p className="text-gray-400 text-sm leading-relaxed">
                        {milestone.description}
                      </p>
                    </div>
                  </div>
                  <div className="hidden md:block md:w-1/2"></div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Villages Section */}
      <section className="py-20 px-4 bg-gray-800/30">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Our 4 Village Units
          </h2>
          <p className="text-gray-400 text-lg mb-12">
            United under one association, stronger together
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {["VILLAGE-UNIT 1", "VILLAGE-UNIT 2", "VILLAGE-UNIT 3", "VILLAGE-UNIT 4"].map(
              (village, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-gray-800 border border-gray-700 rounded-2xl p-6 hover:border-emerald-500/50 transition-all"
                >
                  <div className="text-4xl mb-3">🏘️</div>
                  <p className="text-white font-semibold text-sm">{village}</p>
                </motion.div>
              ),
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="relative overflow-hidden rounded-3xl">
            <img
              src={slide2}
              alt="Community"
              className="w-full h-64 object-cover"
            />
            <div className="absolute inset-0 bg-gray-900/80"></div>
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Ready to Join?
              </h2>
              <p className="text-gray-300 text-lg mb-8">
                Register your account today and become part of the Umuagu Youth
                digital community.
              </p>
              <Link
                to="/register"
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-10 py-4 rounded-xl transition-all transform hover:scale-105 shadow-lg shadow-emerald-500/25 inline-block"
              >
                Get Started Now
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={leopard}
              alt="Logo"
              className="w-8 h-8 rounded-full object-cover border border-emerald-500"
            />
            <p className="text-gray-400 text-sm">
              Umuagu General Youth Association
            </p>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="#history"
              className="text-gray-500 hover:text-emerald-400 text-sm transition-colors"
            >
              History
            </a>
            <a
              href="#activities"
              className="text-gray-500 hover:text-emerald-400 text-sm transition-colors"
            >
              Activities
            </a>
            <Link
              to="/register"
              className="text-gray-500 hover:text-emerald-400 text-sm transition-colors"
            >
              Join Us
            </Link>
          </div>
          <p className="text-gray-600 text-sm">
            © 2026 Umuagu Youth. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

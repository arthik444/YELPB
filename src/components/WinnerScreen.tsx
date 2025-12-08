import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Phone, Clock, Navigation, Calendar, Star, Share2, Users, Sparkles, Check, Trophy, CalendarPlus } from 'lucide-react';

interface WinnerScreenProps {
  onNavigate: () => void;
}

export function WinnerScreen({ onNavigate }: WinnerScreenProps) {
  const [showConfetti, setShowConfetti] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'group'>('details');

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-black">
      {/* Confetti effect */}
      <AnimatePresence>
        {showConfetti && (
          <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
            {[...Array(50)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-3 h-3 rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: -20,
                  background: ['#F97316', '#fb923c', '#FBBF24', '#F59E0B', '#DC2626'][Math.floor(Math.random() * 5)],
                }}
                initial={{ y: -20, opacity: 1, rotate: 0 }}
                animate={{
                  y: window.innerHeight + 20,
                  opacity: [1, 1, 0],
                  rotate: 360 * (Math.random() > 0.5 ? 1 : -1),
                  x: (Math.random() - 0.5) * 200,
                }}
                transition={{
                  duration: 2 + Math.random() * 2,
                  delay: Math.random() * 0.5,
                  ease: 'easeIn',
                }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Hero Image */}
      <div className="relative h-[55vh] w-full overflow-hidden">
        <motion.div
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
          className="h-full w-full bg-cover bg-center"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1757358957218-67e771ec07bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb3VybWV0JTIwZm9vZCUyMHBob3RvZ3JhcGh5fGVufDF8fHx8MTc2NTE0MDQ0Mnww&ixlib=rb-4.1.0&q=80&w=1080')`
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/50 to-black" />
          
          {/* Trophy icon */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.5, type: 'spring', bounce: 0.6 }}
            className="absolute left-1/2 top-12 -translate-x-1/2"
          >
            <div className="relative">
              <motion.div
                animate={{
                  boxShadow: [
                    '0 0 30px rgba(249,115,22,0.4)',
                    '0 0 50px rgba(249,115,22,0.7)',
                    '0 0 30px rgba(249,115,22,0.4)',
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="rounded-full bg-gradient-to-br from-[#F97316] to-[#fb923c] p-4"
              >
                <Trophy className="h-8 w-8 text-white" />
              </motion.div>
            </div>
          </motion.div>
          
          {/* Overlaid text */}
          <div className="absolute inset-x-0 bottom-0 p-8 pb-6">
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: 'spring', bounce: 0.3 }}
                className="mb-4 inline-block"
              >
                <div className="glassmorphism-premium rounded-full px-5 py-2 backdrop-blur-xl">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#F97316]" />
                    <span className="text-sm tracking-widest text-[#F97316]" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
                      TONIGHT&apos;S SPOT
                    </span>
                  </div>
                </div>
              </motion.div>
              <h1 
                className="mb-2 bg-gradient-to-r from-white to-orange-100 bg-clip-text text-6xl text-transparent drop-shadow-2xl"
                style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }}
              >
                Trattoria Luna
              </h1>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <Star className="h-5 w-5 fill-[#F97316] text-[#F97316]" />
                  <span className="text-lg text-white">4.8</span>
                </div>
                <span className="text-gray-400">•</span>
                <span className="text-lg text-gray-300">Italian</span>
                <span className="text-gray-400">•</span>
                <span className="text-lg text-[#F97316]">$$</span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Content Section */}
      <div className="relative -mt-6 px-6">
        {/* Tabs */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="glassmorphism-premium mb-6 flex rounded-2xl p-1.5 backdrop-blur-xl"
        >
          <button
            onClick={() => setActiveTab('details')}
            className={`flex-1 rounded-xl px-4 py-3 text-sm transition-all ${
              activeTab === 'details'
                ? 'bg-gradient-to-r from-[#F97316] to-[#fb923c] text-white shadow-lg'
                : 'text-gray-400'
            }`}
            style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('group')}
            className={`flex-1 rounded-xl px-4 py-3 text-sm transition-all ${
              activeTab === 'group'
                ? 'bg-gradient-to-r from-[#F97316] to-[#fb923c] text-white shadow-lg'
                : 'text-gray-400'
            }`}
            style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}
          >
            Group Vote
          </button>
        </motion.div>

        <AnimatePresence mode="wait">
          {activeTab === 'details' ? (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="space-y-4 pb-80"
            >
              {/* Info Cards */}
              <InfoCard
                icon={<MapPin className="h-6 w-6 text-[#F97316]" />}
                label="Address"
                value="123 Via Roma, Downtown"
                delay={0.7}
              />

              <InfoCard
                icon={<Clock className="h-6 w-6 text-[#F97316]" />}
                label="Hours Today"
                value="5:00 PM - 11:00 PM"
                delay={0.8}
                badge="Open Now"
              />

              <InfoCard
                icon={<Phone className="h-6 w-6 text-[#F97316]" />}
                label="Contact"
                value="(555) 123-4567"
                delay={0.9}
              />

              {/* Features */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                className="glassmorphism-premium rounded-2xl p-6 backdrop-blur-xl"
              >
                <h3 className="mb-4 flex items-center gap-2 text-white" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
                  <Sparkles className="h-5 w-5 text-[#F97316]" />
                  Why We Picked This
                </h3>
                <div className="space-y-3">
                  {[
                    'Perfect match for your budget & cuisine preference',
                    'Trending in your area this week',
                    'Excellent ratings from verified diners',
                    'Known for authentic handmade pasta'
                  ].map((feature, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1.1 + index * 0.1 }}
                      className="flex items-start gap-3"
                    >
                      <div className="mt-0.5 rounded-full bg-green-500/20 p-1">
                        <Check className="h-3 w-3 text-green-400" />
                      </div>
                      <span className="text-sm text-gray-300">{feature}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="group"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-4 pb-80"
            >
              {/* Group Stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glassmorphism-premium rounded-2xl p-6 backdrop-blur-xl"
              >
                <h3 className="mb-6 flex items-center gap-2 text-white" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
                  <Users className="h-5 w-5 text-[#F97316]" />
                  Final Results
                </h3>
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <motion.p
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: 'spring', bounce: 0.6 }}
                      className="mb-1 text-4xl text-[#F97316]"
                      style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }}
                    >
                      4/5
                    </motion.p>
                    <p className="text-xs text-gray-400">Votes</p>
                  </div>
                  <div className="h-16 w-px bg-white/10" />
                  <div className="text-center">
                    <motion.p
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.3, type: 'spring', bounce: 0.6 }}
                      className="mb-1 text-4xl text-[#F97316]"
                      style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }}
                    >
                      80%
                    </motion.p>
                    <p className="text-xs text-gray-400">Match</p>
                  </div>
                  <div className="h-16 w-px bg-white/10" />
                  <div className="text-center">
                    <motion.p
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.4, type: 'spring', bounce: 0.6 }}
                      className="mb-1 text-4xl text-[#F97316]"
                      style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }}
                    >
                      4.8
                    </motion.p>
                    <p className="text-xs text-gray-400">Rating</p>
                  </div>
                </div>
              </motion.div>

              {/* Individual votes */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glassmorphism-premium rounded-2xl p-6 backdrop-blur-xl"
              >
                <h3 className="mb-4 text-sm text-gray-400">INDIVIDUAL VOTES</h3>
                <div className="space-y-3">
                  {[
                    { name: 'You', voted: true, color: 'from-orange-500 to-red-500' },
                    { name: 'Sarah', voted: true, color: 'from-purple-500 to-pink-500' },
                    { name: 'Mike', voted: true, color: 'from-blue-500 to-cyan-500' },
                    { name: 'Emma', voted: true, color: 'from-green-500 to-emerald-500' },
                    { name: 'Jake', voted: false, color: 'from-gray-600 to-gray-700' },
                  ].map((member, index) => (
                    <motion.div
                      key={member.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + index * 0.1 }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${member.color}`} />
                        <span className="text-white">{member.name}</span>
                      </div>
                      {member.voted ? (
                        <div className="flex items-center gap-2 rounded-full bg-green-500/20 px-3 py-1">
                          <Check className="h-4 w-4 text-green-400" />
                          <span className="text-xs text-green-400">Liked</span>
                        </div>
                      ) : (
                        <div className="rounded-full bg-gray-800 px-3 py-1">
                          <span className="text-xs text-gray-500">Skipped</span>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Fixed Bottom Actions */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-black via-black to-transparent p-6 pt-12"
      >
        <div className="mb-4 flex gap-3">
          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-white/20 bg-white/5 px-6 py-4 backdrop-blur-md transition-all hover:border-white/30 hover:bg-white/10"
          >
            <Share2 className="h-5 w-5 text-white" />
          </motion.button>

          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.95 }}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-white/20 bg-white/5 px-6 py-4 backdrop-blur-md transition-all hover:border-white/30 hover:bg-white/10"
          >
            <Navigation className="h-5 w-5 text-white" />
            <span className="text-white" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
              Directions
            </span>
          </motion.button>
        </div>

        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="mb-3 w-full rounded-2xl border-2 border-orange-500/30 bg-orange-500/10 py-4 backdrop-blur-md transition-all hover:border-orange-500/50 hover:bg-orange-500/20"
        >
          <div className="flex items-center justify-center gap-2">
            <Calendar className="h-5 w-5 text-[#F97316]" />
            <span className="text-[#F97316]" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
              Add to Calendar
            </span>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.01, y: -2 }}
          whileTap={{ scale: 0.99 }}
          className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-[#F97316] via-orange-500 to-[#fb923c] py-5 shadow-2xl"
          animate={{
            boxShadow: [
              '0 20px 60px -12px rgba(249,115,22,0.5)',
              '0 30px 80px -12px rgba(249,115,22,0.8)',
              '0 20px 60px -12px rgba(249,115,22,0.5)',
            ]
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <motion.div 
            className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0"
            animate={{ x: ['-200%', '200%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
          <div className="relative flex items-center justify-center gap-3">
            <CalendarPlus className="h-6 w-6 text-white" />
            <span className="text-xl text-white" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }}>
              BOOK A TABLE
            </span>
          </div>
        </motion.button>

        <button
          onClick={onNavigate}
          className="mt-4 w-full py-3 text-sm text-gray-400 transition-colors hover:text-white"
        >
          Start New Session
        </button>
      </motion.div>
    </div>
  );
}

function InfoCard({ icon, label, value, delay, badge }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delay: number;
  badge?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glassmorphism-premium rounded-2xl p-5 backdrop-blur-xl transition-all hover:bg-white/10"
    >
      <div className="flex items-start gap-4">
        <div className="rounded-full bg-[#F97316]/20 p-3">
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">{label}</p>
            {badge && (
              <span className="rounded-full bg-green-500/20 px-2.5 py-0.5 text-xs text-green-400">
                {badge}
              </span>
            )}
          </div>
          <p className="mt-1 text-white">{value}</p>
        </div>
      </div>
    </motion.div>
  );
}
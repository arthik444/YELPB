import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Phone, Clock, Navigation, Calendar, Star, Share2, Sparkles, Check, Trophy, CalendarPlus, X } from 'lucide-react';
import { apiService } from '../services/api';

interface WinnerScreenProps {
  onNavigate: () => void;
  restaurant?: any;
  preferences?: {
    bookingDate: string;
    bookingTime: string;
    partySize: number;
  };
  isOwner?: boolean;
}

export function WinnerScreen({ onNavigate, restaurant, preferences, isOwner = false }: WinnerScreenProps) {
  const [showConfetti, setShowConfetti] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingDate, setBookingDate] = useState(preferences?.bookingDate || '');
  const [bookingTime, setBookingTime] = useState(preferences?.bookingTime || '19:00');
  const [partySize, setPartySize] = useState(preferences?.partySize || 2);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingMessage, setBookingMessage] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    // Set default date to tomorrow if not provided
    if (!bookingDate) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setBookingDate(tomorrow.toISOString().split('T')[0]);
    }
    return () => clearTimeout(timer);
  }, [bookingDate]);

  // Handle Get Directions - opens Google Maps with restaurant address
  const handleGetDirections = () => {
    const address = restaurant?.address || restaurant?.location?.address1 || '';
    const city = restaurant?.city || restaurant?.location?.city || '';
    const fullAddress = `${address}, ${city}`.trim();

    if (fullAddress && fullAddress !== ', ') {
      // Encode address for URL
      const encodedAddress = encodeURIComponent(fullAddress);
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, '_blank');
    } else if (restaurant?.coordinates) {
      // Use coordinates if no address
      const { latitude, longitude } = restaurant.coordinates;
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`, '_blank');
    } else {
      // Fallback: search by restaurant name
      const searchQuery = encodeURIComponent(restaurantName);
      window.open(`https://www.google.com/maps/search/?api=1&query=${searchQuery}`, '_blank');
    }
  };

  // Handle Add to Calendar - opens Google Calendar directly
  const handleAddToCalendar = () => {
    const eventDate = new Date(bookingDate + 'T' + bookingTime);
    const endDate = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours later

    // Format dates for Google Calendar URL (YYYYMMDDTHHMMSS)
    const formatGoogleDate = (date: Date) => {
      return date.toISOString().replace(/-|:|\.\d\d\d/g, '').slice(0, -1);
    };

    const address = restaurant?.address || restaurant?.location?.address1 || '';
    const city = restaurant?.city || restaurant?.location?.city || '';
    const fullAddress = `${address}, ${city}`.trim();

    const eventTitle = `Dinner at ${restaurantName}`;
    const eventDetails = `Dinner reservation at ${restaurantName}. Party size: ${partySize}. ${restaurant?.phone ? 'Phone: ' + restaurant.phone : ''}`;

    // Build Google Calendar URL
    const googleCalendarUrl = new URL('https://calendar.google.com/calendar/render');
    googleCalendarUrl.searchParams.set('action', 'TEMPLATE');
    googleCalendarUrl.searchParams.set('text', eventTitle);
    googleCalendarUrl.searchParams.set('dates', `${formatGoogleDate(eventDate)}/${formatGoogleDate(endDate)}`);
    googleCalendarUrl.searchParams.set('details', eventDetails);
    googleCalendarUrl.searchParams.set('location', fullAddress || restaurantName);

    // Open Google Calendar in new tab
    window.open(googleCalendarUrl.toString(), '_blank');
  };

  const handleBookReservation = async () => {
    if (!restaurant || !bookingDate || !bookingTime) {
      alert('Please select a date and time');
      return;
    }

    setIsBooking(true);
    try {
      const response = await apiService.bookReservation(
        restaurant.name,
        partySize,
        bookingDate,
        bookingTime,
        37.7749, // TODO: Use actual user location
        -122.4194
      );

      setBookingSuccess(true);
      setBookingMessage(response.message || 'Reservation request sent! Check Yelp for confirmation.');
      setTimeout(() => {
        setShowBookingModal(false);
        setBookingSuccess(false);
      }, 3000);
    } catch (error: any) {
      alert(`Booking failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsBooking(false);
    }
  };

  const restaurantName = restaurant?.name || 'Trattoria Luna';
  const restaurantRating = restaurant?.rating || 4.8;
  const restaurantCuisine = restaurant?.cuisine || 'Italian';
  const restaurantPrice = restaurant?.price || '$$';
  const restaurantImage = restaurant?.image || 'https://images.unsplash.com/photo-1757358957218-67e771ec07bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb3VybWV0JTIwZm9vZCUyMHBob3RvZ3JhcGh5fGVufDF8fHx8MTc2NTE0MDQ0Mnww&ixlib=rb-4.1.0&q=80&w=1080';

  return (
    <div className="min-h-screen bg-white">
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
                  background: ['#f97316', '#fb923c', '#fbbf24', '#f59e0b', '#f87171'][Math.floor(Math.random() * 5)],
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
            backgroundImage: `url('${restaurantImage}')`
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-white" />

          {/* Trophy icon */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.5, type: 'spring', bounce: 0.6 }}
            className="absolute left-1/2 top-8 -translate-x-1/2"
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
                <div className="rounded-full px-5 py-2 bg-white/95 backdrop-blur-xl border border-orange-200 shadow-lg">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#f97316]" />
                    <span className="text-sm tracking-widest text-[#f97316]" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
                      TONIGHT&apos;S SPOT
                    </span>
                  </div>
                </div>
              </motion.div>
              <h1
                className="mb-2 text-6xl text-white drop-shadow-2xl"
                style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }}
              >
                {restaurantName}
              </h1>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <Star className="h-6 w-6 fill-[#f97316] text-[#f97316] drop-shadow-lg" />
                  <span className="text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{restaurantRating}</span>
                </div>
                <span className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">•</span>
                <span className="text-lg font-semibold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{restaurantCuisine}</span>
                <span className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">•</span>
                <span className="text-lg font-bold text-[#f97316] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{restaurantPrice}</span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Content Section */}
      <div className="relative pt-6 px-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6 pb-80"

        >
          {/* AI Tie-Breaker Banner */}
          {restaurant?.winningReason && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-purple-50 p-5 shadow-md"
            >
              <div className="flex items-start gap-4">
                <div className="mt-1 rounded-full bg-gradient-to-r from-orange-500 to-purple-500 p-2 text-white">
                  <Trophy className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="mb-1 text-sm font-bold text-gray-900 uppercase tracking-wider" style={{ color: '#111827' }}>
                    AI Judge's Decision
                  </h3>
                  <p className="text-sm font-medium text-gray-700 leading-relaxed" style={{ color: '#374151' }}>
                    "{restaurant.winningReason}"
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Info Cards */}

          <InfoCard
            icon={<MapPin className="h-6 w-6 text-[#f97316]" style={{ color: '#f97316', stroke: '#f97316' }} />}
            label="Address"
            value={`${restaurant?.address || restaurant?.location?.address1 || 'Address not available'}${restaurant?.city || restaurant?.location?.city ? ', ' + (restaurant?.city || restaurant?.location?.city) : ''}`}
            delay={0.7}
          />

          <InfoCard
            icon={<Clock className="h-6 w-6 text-[#f97316]" style={{ color: '#f97316', stroke: '#f97316' }} />}
            label="Reservation"
            value={`${bookingDate} at ${bookingTime}`}
            delay={0.8}
            badge={`${partySize} ${partySize === 1 ? 'person' : 'people'}`}
          />

          <InfoCard
            icon={<Phone className="h-6 w-6 text-[#f97316]" style={{ color: '#f97316', stroke: '#f97316' }} />}
            label="Contact"
            value={restaurant?.phone || 'Phone not available'}
            delay={0.9}
          />

          {/* Features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-md"
          >
            <h3 className="mb-4 text-lg font-bold text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: '#111827' }}>
              Why We Picked This
            </h3>
            <div className="space-y-4">
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
                  <div className="mt-0.5 rounded-full bg-green-100 p-1">
                    <Check className="h-3 w-3 text-green-600" />
                  </div>
                  <span className="text-sm text-gray-700" style={{ color: '#374151' }}>{feature}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Fixed Bottom Actions */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="fixed inset-x-0 bottom-0 bg-white p-6 pt-12 border-t border-gray-100 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]"
      >
        <div className="mb-4 flex gap-3">
          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-gray-300 bg-white px-6 py-4 transition-all hover:border-gray-400 hover:bg-gray-50 shadow-sm"
          >
            <Share2 className="h-5 w-5 text-gray-700" style={{ color: '#374151', stroke: '#374151' }} />
          </motion.button>

          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleGetDirections}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-gray-300 bg-white px-6 py-4 transition-all hover:border-gray-400 hover:bg-gray-50 shadow-sm"
          >
            <Navigation className="h-5 w-5 text-gray-700" style={{ color: '#374151', stroke: '#374151' }} />
            <span className="text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: '#111827' }}>
              Directions
            </span>
          </motion.button>
        </div>

        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleAddToCalendar}
          className="mb-3 w-full rounded-2xl border-2 border-orange-200 bg-orange-50 py-4 transition-all hover:border-orange-300 hover:bg-orange-100 shadow-sm"
        >
          <div className="flex items-center justify-center gap-2">
            <Calendar className="h-5 w-5 text-[#f97316]" style={{ color: '#f97316', stroke: '#f97316' }} />
            <span className="text-[#f97316]" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: '#f97316' }}>
              Add to Calendar
            </span>
          </div>
        </motion.button>

        {/* Book A Table - only visible to group owner */}
        {isOwner && (
          <motion.button
            whileHover={{ scale: 1.01, y: -2 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setShowBookingModal(true)}
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
        )}

        <button
          onClick={onNavigate}
          className="mt-4 w-full py-3 text-sm text-gray-500 transition-colors hover:text-gray-700"
          style={{ color: '#6b7280' }}
        >
          Start New Session
        </button>
      </motion.div>

      {/* Booking Modal */}
      <AnimatePresence>
        {showBookingModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => !isBooking && setShowBookingModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl bg-white border border-gray-200 p-6 shadow-2xl"
            >
              {bookingSuccess ? (
                <div className="text-center py-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', bounce: 0.5 }}
                    className="mx-auto mb-4 h-20 w-20 rounded-full bg-green-100 flex items-center justify-center"
                  >
                    <Check className="h-10 w-10 text-green-600" />
                  </motion.div>
                  <h3 className="text-2xl text-gray-900 mb-2" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: '#111827' }}>
                    Booking Sent!
                  </h3>
                  <p className="text-gray-600" style={{ color: '#4b5563' }}>{bookingMessage}</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl text-gray-900" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: '#111827' }}>
                      Book a Table
                    </h3>
                    <button
                      onClick={() => setShowBookingModal(false)}
                      className="rounded-full p-2 hover:bg-gray-100 transition-colors"
                    >
                      <X className="h-5 w-5 text-gray-500" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-2" style={{ color: '#4b5563' }}>Party Size</label>
                      <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
                        <span className="text-gray-900 text-lg" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: '#111827' }}>
                          {partySize} {partySize === 1 ? 'person' : 'people'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 mb-2" style={{ color: '#4b5563' }}>Date</label>
                      <input
                        type="date"
                        value={bookingDate}
                        onChange={(e) => setBookingDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-gray-900 focus:border-[#f97316] focus:outline-none focus:ring-2 focus:ring-orange-200"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 mb-2" style={{ color: '#4b5563' }}>Time</label>
                      <input
                        type="time"
                        value={bookingTime}
                        onChange={(e) => setBookingTime(e.target.value)}
                        className="w-full rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-gray-900 focus:border-[#f97316] focus:outline-none focus:ring-2 focus:ring-orange-200"
                      />
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleBookReservation}
                      disabled={isBooking}
                      className="w-full rounded-xl bg-gradient-to-r from-[#f97316] to-[#fb923c] py-4 text-white disabled:opacity-50 shadow-lg"
                      style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}
                    >
                      {isBooking ? 'Booking...' : 'Confirm Booking'}
                    </motion.button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
      className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-gray-300"
    >
      <div className="flex items-start gap-4">
        <div className="rounded-full bg-orange-100 p-3">
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500" style={{ color: '#6b7280' }}>{label}</p>
            {badge && (
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs text-green-700 font-medium">
                {badge}
              </span>
            )}
          </div>
          <p className="mt-1 text-gray-900 font-medium" style={{ color: '#1C1917' }}>{value}</p>
        </div>
      </div>
    </motion.div>
  );
}
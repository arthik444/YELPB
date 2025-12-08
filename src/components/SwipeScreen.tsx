import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'motion/react';
import { X, Heart, Star, MapPin, Clock, TrendingUp, Award, Info, Loader2 } from 'lucide-react';
import { useYelpSearch } from '../hooks/useYelpSearch';
import { useGeolocation } from '../hooks/useGeolocation';
import { Business } from '../services/api';

interface SwipeScreenProps {
  onNavigate: () => void;
}

interface Restaurant {
  id: string | number;
  name: string;
  image: string;
  rating: number;
  price: string;
  cuisine: string;
  distance: string;
  specialty: string;
  waitTime: string;
  trending: boolean;
}

interface LikedRestaurant {
  id: string;
  name: string;
  timestamp: number;
}

export function SwipeScreen({ onNavigate }: SwipeScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [likedRestaurants, setLikedRestaurants] = useState<LikedRestaurant[]>([]);
  const [showYumAnimation, setShowYumAnimation] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);

  const { businesses, loading, error, search } = useYelpSearch();
  const { location, requestLocation, error: locationError } = useGeolocation(false);

  useEffect(() => {
    requestLocation();
    const timer = setTimeout(() => {
      fetchRestaurants(location?.latitude, location?.longitude);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (location) {
      fetchRestaurants(location.latitude, location.longitude);
    }
  }, [location]);

  const fetchRestaurants = async (lat?: number, lng?: number) => {
    const results = await search({
      query: 'restaurants',
      latitude: lat || 37.7749,
      longitude: lng || -122.4194,
      locale: 'en_US',
    });

    const formattedRestaurants: Restaurant[] = results.map((business) => ({
      id: business.id,
      name: business.name,
      image: business.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4',
      rating: business.rating || 4.0,
      price: business.price || '$$',
      cuisine: business.categories?.[0]?.title || 'Restaurant',
      distance: business.distance || 'N/A',
      specialty: business.categories?.[0]?.title || 'Local Cuisine',
      waitTime: '20-30 min',
      trending: (business.rating || 0) > 4.5,
    }));

    setRestaurants(formattedRestaurants);
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-[#F97316]" />
          <p className="mt-4 text-white">Loading restaurants...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <div className="text-center">
          <p className="text-red-500">{error}</p>
          <button
            onClick={fetchRestaurants}
            className="mt-4 rounded-lg bg-[#F97316] px-6 py-2 text-white hover:bg-orange-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (restaurants.length === 0) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <p className="text-white">No restaurants found.</p>
      </div>
    );
  }

  const currentRestaurant = restaurants[currentIndex];

  const handleSwipe = (swipeDirection: 'left' | 'right') => {
    const currentRestaurant = restaurants[currentIndex];

    if (swipeDirection === 'right' && currentRestaurant) {
      // Show YUM animation
      setShowYumAnimation(true);
      setTimeout(() => setShowYumAnimation(false), 600);

      // Track liked restaurant
      setLikedRestaurants(prev => [...prev, {
        id: currentRestaurant.id.toString(),
        name: currentRestaurant.name,
        timestamp: Date.now(),
      }]);
    }

    setDirection(swipeDirection);

    setTimeout(() => {
      if (currentIndex === restaurants.length - 1) {
        onNavigate();
      } else {
        setCurrentIndex(currentIndex + 1);
        setDirection(null);
        setShowInfo(false);
      }
    }, 400);
  };

  if (!currentRestaurant) return null;

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      {/* "YUM!" Explosion Animation */}
      {showYumAnimation && (
        <motion.div
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 3.5, opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
        >
          <div className="text-[12rem] font-black text-[#F97316] drop-shadow-2xl" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            YUM!
          </div>
        </motion.div>
      )}

      {/* Next card preview (behind) */}
      {currentIndex < restaurants.length - 1 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0.5 }}
            animate={{ scale: 0.95, opacity: 0.8 }}
            className="absolute inset-8 overflow-hidden rounded-[32px]"
            style={{
              backgroundImage: `url(${restaurants[currentIndex + 1].image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        </div>
      )}

      {/* Current Card */}
      <AnimatePresence mode="wait">
        <SwipeCard
          key={currentRestaurant.id}
          restaurant={currentRestaurant}
          onSwipe={handleSwipe}
          direction={direction}
          showInfo={showInfo}
          onToggleInfo={() => setShowInfo(!showInfo)}
        />
      </AnimatePresence>

      {/* Progress indicator */}
      <div className="absolute left-0 right-0 top-8 z-30 px-6">
        <div className="flex justify-between gap-1.5">
          {restaurants.map((_, index) => (
            <motion.div
              key={index}
              className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/20 backdrop-blur-sm"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: index * 0.05 }}
            >
              <motion.div
                className="h-full bg-gradient-to-r from-[#F97316] to-orange-400 shadow-lg shadow-orange-500/50"
                initial={{ width: '0%' }}
                animate={{ width: index <= currentIndex ? '100%' : '0%' }}
                transition={{ duration: 0.5 }}
              />
            </motion.div>
          ))}
        </div>
        
        {/* Counter */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 text-center"
        >
          <span className="text-sm text-white/80">
            {currentIndex + 1} / {restaurants.length}
          </span>
        </motion.div>
      </div>

      {/* Swipe indicators */}
      <AnimatePresence>
        {direction === 'left' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, rotate: -30 }}
            animate={{ opacity: 1, scale: 1, rotate: -15 }}
            exit={{ opacity: 0 }}
            className="absolute left-12 top-1/3 z-30 rounded-2xl border-8 border-red-500 bg-red-500/20 px-8 py-4 backdrop-blur-sm"
          >
            <span className="text-5xl text-red-500" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }}>
              NOPE
            </span>
          </motion.div>
        )}
        {direction === 'right' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, rotate: 30 }}
            animate={{ opacity: 1, scale: 1, rotate: 15 }}
            exit={{ opacity: 0 }}
            className="absolute right-12 top-1/3 z-30 rounded-2xl border-8 border-[#F97316] bg-orange-500/20 px-8 py-4 backdrop-blur-sm"
          >
            <span className="text-5xl text-[#F97316]" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }}>
              LIKE
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons */}
      <div className="absolute inset-x-0 bottom-12 z-20 px-8">
        <div className="flex items-center justify-center gap-6">
          <motion.button
            whileHover={{ scale: 1.15, rotate: -5 }}
            whileTap={{ scale: 0.85 }}
            onClick={() => handleSwipe('left')}
            className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-red-500 bg-white shadow-2xl shadow-red-500/30 transition-all hover:bg-red-50"
          >
            <X className="h-8 w-8 text-red-500" strokeWidth={3} />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowInfo(!showInfo)}
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/50 bg-white/10 backdrop-blur-md transition-all hover:bg-white/20"
          >
            <Info className="h-5 w-5 text-white" strokeWidth={2.5} />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.15, rotate: 5 }}
            whileTap={{ scale: 0.85 }}
            onClick={() => handleSwipe('right')}
            className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-[#F97316] bg-white shadow-2xl transition-all hover:bg-orange-50"
            animate={{
              boxShadow: [
                '0 20px 60px -12px rgba(249,115,22,0.4)',
                '0 20px 80px -12px rgba(249,115,22,0.7)',
                '0 20px 60px -12px rgba(249,115,22,0.4)',
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Heart className="h-10 w-10 text-[#F97316]" strokeWidth={3} fill="currentColor" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}

interface SwipeCardProps {
  restaurant: typeof restaurants[0];
  onSwipe: (direction: 'left' | 'right') => void;
  direction: 'left' | 'right' | null;
  showInfo: boolean;
  onToggleInfo: () => void;
}

function SwipeCard({ restaurant, onSwipe, direction, showInfo }: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-30, 30]);
  const opacity = useTransform(x, [-300, -150, 0, 150, 300], [0.5, 1, 1, 1, 0.5]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > 120) {
      onSwipe('right');
    } else if (info.offset.x < -120) {
      onSwipe('left');
    }
  };

  return (
    <motion.div
      className="absolute inset-0 z-20"
      style={{ x, rotate, opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={
        direction
          ? { x: direction === 'left' ? -1000 : 1000, opacity: 0, transition: { duration: 0.4 } }
          : { scale: 1, opacity: 1, x: 0 }
      }
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="relative h-full w-full px-4 py-6">
        <div className="h-full w-full overflow-hidden rounded-[32px] shadow-2xl">
          {/* Full-screen image */}
          <div
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${restaurant.image})` }}
          >
            {/* Gradient overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-transparent" />

            {/* Top badges */}
            <div className="absolute left-6 right-6 top-20 flex items-start justify-between">
              {restaurant.trending && (
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.2, type: 'spring', bounce: 0.5 }}
                  className="flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-3 py-1.5 shadow-lg shadow-orange-500/50"
                >
                  <TrendingUp className="h-4 w-4 text-white" />
                  <span className="text-xs text-white" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
                    TRENDING
                  </span>
                </motion.div>
              )}
              
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring', bounce: 0.5 }}
                className="ml-auto rounded-full bg-black/40 px-3 py-1.5 backdrop-blur-md"
              >
                <div className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-[#F97316] text-[#F97316]" />
                  <span className="text-sm text-white" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
                    {restaurant.rating}
                  </span>
                </div>
              </motion.div>
            </div>

            {/* Restaurant details overlay */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="absolute inset-x-0 bottom-0 px-8 pb-32 pt-8 text-white"
            >
              {/* Quick info tags */}
              <div className="mb-4 flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 backdrop-blur-md">
                  <MapPin className="h-3 w-3" />
                  <span className="text-xs">{restaurant.distance}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 backdrop-blur-md">
                  <Clock className="h-3 w-3" />
                  <span className="text-xs">{restaurant.waitTime}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-orange-500/20 px-3 py-1 backdrop-blur-md">
                  <Award className="h-3 w-3 text-orange-400" />
                  <span className="text-xs text-orange-400">{restaurant.specialty}</span>
                </div>
              </div>

              <h2 
                className="mb-2 text-5xl text-white drop-shadow-2xl"
                style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }}
              >
                {restaurant.name}
              </h2>
              
              <div className="flex items-center gap-3 text-xl">
                <span className="text-[#F97316]" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
                  {restaurant.price}
                </span>
                
                <span className="text-gray-300">•</span>
                
                <span className="text-gray-200">{restaurant.cuisine}</span>
              </div>

              {/* Additional info panel */}
              <AnimatePresence>
                {showInfo && (
                  <motion.div
                    initial={{ height: 0, opacity: 0, marginTop: 0 }}
                    animate={{ height: 'auto', opacity: 1, marginTop: 16 }}
                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="glassmorphism-premium space-y-2 rounded-2xl p-4 backdrop-blur-xl">
                      <p className="text-sm text-gray-300">
                        Known for exceptional {restaurant.specialty.toLowerCase()} and warm ambiance. 
                        Perfect for your group dining experience.
                      </p>
                      <div className="flex items-center gap-2 pt-2">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500" />
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-500" />
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500" />
                        <span className="ml-1 text-xs text-gray-400">3 friends liked this</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
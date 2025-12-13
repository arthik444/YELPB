import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'motion/react';
import { X, Heart, Star, MapPin, Clock, TrendingUp, Award, Info, Loader2, Phone, ExternalLink, ChefHat, RotateCcw } from 'lucide-react';
import { useYelpSearch } from '../hooks/useYelpSearch';
import { useGeolocation } from '../hooks/useGeolocation';
import { Business, apiService } from '../services/api';
import { sessionService } from '../services/sessionService';

interface SwipeScreenProps {
  onNavigate: (winner: Restaurant | null) => void;
  preferences?: {
    cuisine: string;
    budget: string;
    vibe: string;
    dietary: string;
    distance: string;
  };
  sessionCode?: string;  // For sharing restaurants via Firebase
  isOwner?: boolean;     // Owner fetches and saves, others read from Firebase
}

interface MenuItem {
  name: string;
  price?: string;
  description?: string;
}

interface MenuCategory {
  name: string;
  items: MenuItem[];
}

interface MenuData {
  categories: MenuCategory[];
  highlights?: string[];
  price_range?: string;
}

interface Restaurant {
  id: string | number;
  name: string;
  image: string;
  rating: number;
  reviewCount: number;
  price: string;
  cuisine: string;
  distance: string;
  address: string;
  city: string;
  phone: string;
  url: string;
  menuUrl?: string;
  menuData?: MenuData;
  menuError?: string;
  trending: boolean;
  categories: string[];
}

interface LikedRestaurant {
  id: string;
  name: string;
  timestamp: number;
}

export function SwipeScreen({ onNavigate, preferences, sessionCode, isOwner }: SwipeScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [likedRestaurants, setLikedRestaurants] = useState<LikedRestaurant[]>([]);
  const [showYumAnimation, setShowYumAnimation] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [flippedCards, setFlippedCards] = useState<Set<string | number>>(new Set());

  const [isResolvingTie, setIsResolvingTie] = useState(false);
  const [loadingMenus, setLoadingMenus] = useState<Set<string | number>>(new Set());
  const [usedSharedData, setUsedSharedData] = useState(false); // Track if we used shared data

  const { businesses, loading, error, search } = useYelpSearch();
  const { location, requestLocation, error: locationError } = useGeolocation(false);




  const [finishedUserCount, setFinishedUserCount] = useState(0);
  const [totalUserCount, setTotalUserCount] = useState(0);

  // Fetch restaurants - owner fetches from Yelp and saves to Firebase, others LISTEN to Firebase
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let unsubscribeUsers: (() => void) | undefined;

    const loadRestaurants = async () => {
      // Setup subscription for everyone (Owner AND Non-Owner) to get winner/user updates
      if (sessionCode) {
        unsubscribe = sessionService.subscribeToSession(sessionCode, (data) => {
          // Sync shared deck (Only for Non-Owner)
          if (!isOwner && data.sharedRestaurants && data.sharedRestaurants.length > 0 && !usedSharedData) {
            console.log('📥 Synced', data.sharedRestaurants.length, 'shared restaurants from Firebase');
            setRestaurants(data.sharedRestaurants as Restaurant[]);
            setIsInitialLoad(false);
            setUsedSharedData(true);
          }

          // Sync finished users count
          const finishedCount = data.finishedUsers ? data.finishedUsers.length : 0;
          const userCount = data.users ? Object.keys(data.users).length : 0;

          setFinishedUserCount(finishedCount);
          setTotalUserCount(userCount);

          console.log('📊 User counts updated:', { finishedCount, userCount, data: { finishedUsers: data.finishedUsers, users: data.users } });

          // Sync winner - navigate everyone (INCLUDING OWNER)
          if (data.winnerId) {
            console.log('🏆 Winner declared:', data.winnerId);
            const winnerRest = (data.sharedRestaurants || restaurants).find((r: any) => r.id.toString() === data.winnerId);
            if (winnerRest) {
              onNavigate({ ...winnerRest, winningReason: data.winningReason });
            }
          }

          // Sync cached menu data from other users
          if (data.cachedMenus) {
            setRestaurants(prev => prev.map(r => {
              const cached = data.cachedMenus[r.id];
              if (cached && !r.menuData) {
                console.log('📥 Synced cached menu for:', r.name);
                return { ...r, menuData: cached.data };
              }
              return r;
            }));
          }
        });

        // Also subscribe to users subcollection for accurate count
        unsubscribeUsers = sessionService.subscribeToUsers(sessionCode, (users) => {
          console.log('👥 [SwipeScreen] Users from subcollection:', users.length);
          setTotalUserCount(users.length);
        });
      }

      // Initial Fetch Logic
      if (sessionCode && !isOwner) {
        // Non-owners wait for subscription data (handled above)
        setLoadingPhase(0);
        return;
      }

      // Owner or Solo: Request location and fetch from Yelp
      requestLocation();
      if (location) {
        fetchRestaurants(location.latitude, location.longitude);
      } else {
        fetchRestaurants();
      }
    };

    loadRestaurants();

    return () => {
      if (unsubscribe) unsubscribe();
      if (unsubscribeUsers) unsubscribeUsers();
    };
  }, [sessionCode, isOwner]);

  useEffect(() => {
    // Only fetch if we're owner OR no session (solo mode) AND haven't used shared data
    // And location is ready (and wasn't ready before)
    if (location && (isOwner || !sessionCode) && !usedSharedData) {
      if (restaurants.length === 0) {
        fetchRestaurants(location.latitude, location.longitude);
      }
    }
  }, [location, isOwner, sessionCode, usedSharedData]);

  const fetchRestaurants = async (lat?: number, lng?: number) => {
    // Build query and categories from preferences
    const queryParts = [];
    const categories: string[] = [];

    if (preferences?.cuisine) {
      queryParts.push(preferences.cuisine);
      // Map common cuisines to Yelp category aliases
      const cuisineMap: Record<string, string> = {
        'Italian': 'italian', 'Mexican': 'mexican', 'Asian': 'asianfusion',
        'American': 'newamerican', 'Japanese': 'japanese', 'Chinese': 'chinese',
        'Indian': 'indpak', 'Thai': 'thai', 'Mediterranean': 'mediterranean',
        'French': 'french', 'Korean': 'korean', 'Vietnamese': 'vietnamese'
      };
      if (cuisineMap[preferences.cuisine]) {
        categories.push(cuisineMap[preferences.cuisine]);
      }
    }
    if (preferences?.vibe) queryParts.push(preferences.vibe);
    if (preferences?.dietary && preferences.dietary !== 'None') {
      queryParts.push(preferences.dietary);
    }

    // Map budget to price levels
    const priceMap: Record<string, number[]> = {
      '$': [1], '$$': [1, 2], '$$$': [2, 3], '$$$$': [3, 4]
    };
    const price = preferences?.budget ? priceMap[preferences.budget] : undefined;

    const query = queryParts.length > 0
      ? `best ${queryParts.join(' ')} restaurants`
      : 'best restaurants nearby';

    console.log('Using combinedSearch with:', { query, categories, price });

    try {
      const latitude = lat || 37.7749;
      const longitude = lng || -122.4194;

      // Use the new combined search API
      const results = await apiService.combinedSearch({
        query,
        latitude,
        longitude,
        term: 'restaurants',
        categories: categories.length > 0 ? categories : undefined,
        price,
        limit: 10
      });

      console.log(`Combined search returned ${results.length} unique restaurants`);

      const formattedRestaurants: Restaurant[] = results.map((business) => ({
        id: business.id,
        name: business.name,
        image: business.image || business.image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4',
        rating: business.rating || 4.0,
        reviewCount: business.reviews || (business as any).review_count || 0,
        price: business.price || '$$',
        cuisine: business.categories?.[0]?.title || 'Restaurant',
        distance: business.distance || 'Nearby',
        address: business.location?.address1 || '',
        city: business.location?.city || '',
        phone: business.phone || '',
        url: business.url || '',
        menuUrl: (business as any).attributes?.MenuUrl || (business as any).menuUrl || (business as any).menu_url || '',
        trending: (business.rating || 0) >= 4.5 && (business.reviews || (business as any).review_count || 0) > 100,
        categories: business.tags || business.categories?.map(c => c.title) || [],
      }));

      setRestaurants(formattedRestaurants);

      // If owner and in a session, save restaurants to Firebase for others to use
      if (isOwner && sessionCode && formattedRestaurants.length > 0) {
        try {
          await sessionService.saveRestaurants(sessionCode, formattedRestaurants);
          console.log('📤 Owner saved restaurants to Firebase for group');
        } catch (err) {
          console.error('Failed to save restaurants to Firebase:', err);
        }
      }
    } catch (err) {
      console.error('Error fetching restaurants:', err);
    } finally {
      setIsInitialLoad(false);
    }
  };

  // Loading phases for enhanced UX
  const loadingPhases = [
    { message: isOwner || !sessionCode ? "Locating nearby gems..." : "Connecting to group...", emoji: "📍", duration: 1500 },
    { message: isOwner || !sessionCode ? `Filtering by ${preferences?.cuisine || 'your taste'}...` : "Waiting for host...", emoji: "🍽️", duration: 1500 },
    { message: isOwner || !sessionCode ? "Ranking the best picks..." : "Syncing restaurant deck...", emoji: "⭐", duration: 1500 },
    { message: "Almost ready!", emoji: "🎉", duration: 1000 },
  ];

  const [loadingPhase, setLoadingPhase] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    if (loading || isInitialLoad) {
      const interval = setInterval(() => {
        setLoadingPhase(prev => {
          if (prev < loadingPhases.length - 1) return prev + 1;
          return prev;
        });
      }, 1500);

      const progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev < 100) return prev + 2;
          return prev;
        });
      }, 100);

      return () => {
        clearInterval(interval);
        clearInterval(progressInterval);
      };
    }
  }, [loading, isInitialLoad]);

  const foodEmojis = ['🍕', '🍣', '🌮', '🍜', '🥗', '🍔', '🍝', '🥘', '🍱', '🥡'];

  // Tie breaking loading screen
  if (isResolvingTie) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-black px-6">
        {/* Animated background glow */}
        <motion.div
          className="absolute inset-0 bg-gradient-radial from-orange-500/5 via-transparent to-transparent"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Scales icon with rotation */}
        <motion.div
          className="text-8xl mb-8 relative z-10"
          animate={{
            rotate: [0, -10, 10, -5, 5, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          ⚖️
        </motion.div>

        {/* Title with gradient */}
        <motion.h2
          className="text-4xl font-bold mb-3 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 bg-clip-text text-transparent"
          style={{ fontFamily: 'Montserrat, sans-serif' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Tie Detected!
        </motion.h2>

        {/* Subtitle */}
        <motion.p
          className="text-gray-400 mb-12 max-w-md text-center text-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Consulting the AI Judge to pick the perfect winner based on your group's vibe...
        </motion.p>

        {/* Enhanced loading dots */}
        <div className="flex items-center gap-3 mb-8">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="relative"
              animate={{
                y: [-8, 8, -8],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.2,
              }}
            >
              <div className="w-4 h-4 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full" />
              <motion.div
                className="absolute inset-0 bg-orange-500 rounded-full blur-sm"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 0, 0.5],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            </motion.div>
          ))}
        </div>

        {/* AI thinking indicator */}
        <motion.div
          className="flex items-center gap-2 text-orange-500/70 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <span className="inline-block w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
          <span>AI is analyzing your preferences...</span>
          <span className="inline-block w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
        </motion.div>
      </div>
    );
  }


  if (loading || isInitialLoad) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-black">
        {/* Simple gradient background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(249,115,22,0.12) 0%, rgba(0,0,0,0) 60%)',
          }}
        />

        {/* Main content - properly centered */}
        <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-sm">
          {/* Spinner container */}
          <div className="relative h-24 w-24 mb-6">
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-full bg-[#F97316]/20 blur-2xl animate-pulse" />

            {/* Spinning ring */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-2 rounded-full border-4 border-gray-800/50 border-t-[#F97316] border-r-orange-400"
            />

            {/* Center emoji */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.span
                className="text-3xl"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {loadingPhases[loadingPhase]?.emoji || '🍽️'}
              </motion.span>
            </div>
          </div>

          {/* Phase message */}
          <AnimatePresence mode="wait">
            <motion.p
              key={loadingPhase}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="text-lg text-white mb-3"
              style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}
            >
              {loadingPhases[loadingPhase]?.message || 'Loading...'}
            </motion.p>
          </AnimatePresence>

          {/* Progress bar */}
          <div className="w-48 mb-5">
            <div className="h-1 w-full overflow-hidden rounded-full bg-gray-800">
              <motion.div
                className="h-full bg-gradient-to-r from-[#F97316] to-orange-400"
                initial={{ width: '0%' }}
                animate={{ width: `${Math.min(loadingProgress, 100)}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-500">{Math.min(loadingProgress, 100)}%</p>
          </div>

          {/* Preferences summary */}
          {preferences && (preferences.cuisine || preferences.budget || preferences.vibe) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <p className="mb-2 text-[10px] text-gray-400 uppercase tracking-wider">Looking for</p>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {preferences.cuisine && (
                  <span className="rounded-full bg-[#F97316]/20 px-2.5 py-0.5 text-xs text-[#F97316]">
                    {preferences.cuisine}
                  </span>
                )}
                {preferences.budget && (
                  <span className="rounded-full bg-green-500/20 px-2.5 py-0.5 text-xs text-green-400">
                    {preferences.budget}
                  </span>
                )}
                {preferences.vibe && (
                  <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-xs text-purple-400">
                    {preferences.vibe}
                  </span>
                )}
                {preferences.dietary && preferences.dietary !== 'None' && (
                  <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs text-blue-400">
                    {preferences.dietary}
                  </span>
                )}
              </div>
            </motion.div>
          )}

          {/* Simple bouncing dots */}
          <div className="mt-6 flex justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ y: [0, -6, 0] }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  delay: i * 0.1,
                }}
                className="h-1.5 w-1.5 rounded-full bg-[#F97316]/60"
              />
            ))}
          </div>
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
            onClick={() => fetchRestaurants()}
            className="mt-4 rounded-lg bg-[#F97316] px-6 py-2 text-white hover:bg-orange-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render Waiting / Reveal State if done
  if (currentIndex >= restaurants.length && !loading && !isInitialLoad) {
    if (sessionCode) {
      const progress = totalUserCount > 0 ? (finishedUserCount / totalUserCount) * 100 : 0;

      return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-black px-6 text-center">
          {/* Animated Icon */}
          <motion.div
            className="mb-8 relative"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            {/* Pulsing rings */}
            <motion.div
              className="absolute inset-0 rounded-full bg-orange-500/20"
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.3, 0, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.div
              className="absolute inset-0 rounded-full bg-orange-500/20"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.2, 0, 0.2],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5,
              }}
            />

            {/* Icon container */}
            <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/30 to-orange-600/30 backdrop-blur-sm border border-orange-500/30">
              {isOwner ? (
                <motion.div
                  animate={{
                    rotate: [0, 10, -10, 0],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <Award className="h-12 w-12 text-orange-500" />
                </motion.div>
              ) : (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                >
                  <Loader2 className="h-12 w-12 text-orange-500" />
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Title */}
          <motion.h2
            className="mb-2 text-3xl font-bold text-white"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {isOwner ? "All Swipes Complete!" : "Waiting for Host"}
          </motion.h2>

          {/* Subtitle */}
          <motion.p
            className="mb-6 text-gray-400 max-w-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {isOwner
              ? "Waiting for everyone to finish deciding..."
              : "Sit tight! The host will reveal the winner shortly."}
          </motion.p>

          {/* Progress indicator */}
          {sessionCode && (
            <motion.div
              className="mb-8 w-full max-w-xs"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
            >
              {/* User count badge */}
              <div className="mb-4 inline-block rounded-full bg-gradient-to-r from-orange-500/20 to-orange-600/20 px-6 py-2 text-sm font-semibold text-orange-400 border border-orange-500/30">
                {finishedUserCount} / {totalUserCount > 0 ? totalUserCount : '?'} Users Finished
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>

              {/* User avatars/indicators */}
              <div className="flex justify-center gap-2 mt-4">
                {Array.from({ length: totalUserCount > 0 ? totalUserCount : 0 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className={`w-3 h-3 rounded-full ${i < finishedUserCount
                      ? 'bg-orange-500'
                      : 'bg-gray-700'
                      }`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                  >
                    {i < finishedUserCount && (
                      <motion.div
                        className="w-full h-full rounded-full bg-orange-400"
                        animate={{
                          scale: [1, 1.3, 1],
                          opacity: [1, 0.5, 1],
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                        }}
                      />
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Reveal button (owner only) */}
          {isOwner && (
            <motion.button
              disabled={totalUserCount === 0 || finishedUserCount < totalUserCount}
              onClick={async () => {
                setIsResolvingTie(true);
                try {
                  const winner = await sessionService.getWinnerRestaurant(sessionCode);
                  if (winner) {
                    // Set the winner in Firebase so non-owners can navigate
                    await sessionService.setWinner(sessionCode, winner.restaurantId, winner.winningReason);
                    // Navigate the owner directly (don't wait for subscription)
                    console.log('🎯 Owner navigating to winner:', winner);
                    onNavigate(winner);
                  } else {
                    alert("No votes? Using fallback.");
                    onNavigate(null);
                  }
                } catch (e) {
                  console.error(e);
                  setIsResolvingTie(false);
                }
              }}
              className={`rounded-xl px-8 py-4 font-bold text-white transition-all shadow-lg ${totalUserCount === 0 || finishedUserCount < totalUserCount
                ? 'bg-gray-700 cursor-not-allowed opacity-50'
                : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 hover:shadow-orange-500/50'
                }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              whileHover={
                totalUserCount > 0 && finishedUserCount >= totalUserCount
                  ? { scale: 1.05 }
                  : {}
              }
              whileTap={
                totalUserCount > 0 && finishedUserCount >= totalUserCount
                  ? { scale: 0.95 }
                  : {}
              }
            >
              {totalUserCount === 0
                ? 'Loading...'
                : finishedUserCount < totalUserCount
                  ? `Waiting for ${totalUserCount - finishedUserCount} more...`
                  : 'Reveal Winner 🏆'}
            </motion.button>
          )}
        </div>
      );
    }
  }


  if (restaurants.length === 0) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <p className="text-white">No restaurants found.</p>
      </div>
    );
  }

  const currentRestaurant = restaurants[currentIndex];


  const handleSwipe = async (swipeDirection: 'left' | 'right') => {
    const currentRestaurant = restaurants[currentIndex];

    if (swipeDirection === 'right' && currentRestaurant) {
      // ... (existing like logic)
      setShowYumAnimation(true);
      setTimeout(() => setShowYumAnimation(false), 600);

      setLikedRestaurants(prev => [...prev, {
        id: currentRestaurant.id.toString(),
        name: currentRestaurant.name,
        timestamp: Date.now(),
      }]);
    }

    // Save swipe to Firebase
    if (sessionCode && currentRestaurant) {
      // ... (existing firebase save logic)
      const userId = localStorage.getItem('userId') || 'anonymous';
      const userName = localStorage.getItem('userName') || 'User';
      try {
        await sessionService.swipeRestaurant(
          sessionCode,
          currentRestaurant.id.toString(),
          swipeDirection,
          userId,
          userName
        );
        console.log(`📊 Swipe recorded: ${currentRestaurant.name} (${swipeDirection})`);
      } catch (err) {
        console.error('Failed to save swipe to Firebase:', err);
      }
    }

    setDirection(swipeDirection);

    setTimeout(async () => {
      if (currentIndex === restaurants.length - 1) {
        // We are done!
        console.log('🎬 User finished swiping! Current index:', currentIndex, 'Total restaurants:', restaurants.length);

        if (sessionCode) {
          // We are in a session.
          // Mark as finished
          const userId = localStorage.getItem('userId');
          console.log('🎬 Marking user as finished:', { sessionCode, userId });
          if (userId) {
            await sessionService.markUserFinished(sessionCode, userId);
          } else {
            console.error('❌ No userId found in localStorage!');
          }

          // DO NOT CALCULATE WINNER YET.
          // Just wait. The UI will render the "waiting" or "reveal" state based on currentIndex
          setCurrentIndex(currentIndex + 1);
        } else {
          // Solo mode - calculate local winner immediately
          let winner = null;
          if (likedRestaurants.length > 0) {
            winner = restaurants.find(r => r.id.toString() === likedRestaurants[0].id) || null;
          }
          onNavigate(winner);
        }
      } else {
        setCurrentIndex(currentIndex + 1);
        setDirection(null);
        setShowInfo(false);
      }
    }, 400);
  };

  // Handle card flip and menu loading
  const handleFlip = async (restaurantId: string | number) => {
    const isCurrentlyFlipped = flippedCards.has(restaurantId);

    // Toggle flip state
    setFlippedCards(prev => {
      const newSet = new Set(prev);
      if (isCurrentlyFlipped) {
        newSet.delete(restaurantId);
      } else {
        newSet.add(restaurantId);
      }
      return newSet;
    });

    // If flipping to back and no menu data, try to load it
    if (!isCurrentlyFlipped) {
      const restaurant = restaurants.find(r => r.id === restaurantId);

      // Only fetch if no data and no prior error
      if (restaurant && !restaurant.menuData && !restaurant.menuError) {
        setLoadingMenus(prev => new Set(prev).add(restaurantId));

        try {
          // First, check Firebase cache for menu data from other users
          if (sessionCode) {
            const cachedMenu = await sessionService.getCachedMenuData(sessionCode, restaurantId.toString());

            if (cachedMenu) {
              // Use cached menu data - no API call needed!
              console.log('✅ Using cached menu from Firebase for:', restaurant.name);
              setRestaurants(prev => prev.map(r =>
                r.id === restaurantId ? { ...r, menuData: cachedMenu } : r
              ));
              setLoadingMenus(prev => {
                const newSet = new Set(prev);
                newSet.delete(restaurantId);
                return newSet;
              });
              return; // Exit early - no need to fetch
            }
          }

          // No cached data - fetch from Yelp AI API
          console.log('🔍 No cached menu found, fetching from API for:', restaurant.name);
          const locationContext = restaurant.city ? ` in ${restaurant.city}` : '';
          const chatResponse = await apiService.chat({
            query: `What are the popular menu items and dishes at ${restaurant.name}${locationContext}? Include prices if available.`,
            user_context: {
              locale: 'en_US',
              latitude: location?.latitude,
              longitude: location?.longitude,
            }
          });

          // Parse the response into menu format
          if (chatResponse.response_text) {
            const menuData = {
              categories: [{
                name: 'Popular Items',
                items: [{ name: chatResponse.response_text, description: '', price: '' }]
              }],
              highlights: [],
              price_range: restaurant.price || '$$',
              aiResponse: chatResponse.response_text
            };

            // Update local state
            setRestaurants(prev => prev.map(r =>
              r.id === restaurantId ? { ...r, menuData } : r
            ));

            // Cache in Firebase for other users
            if (sessionCode) {
              await sessionService.cacheMenuData(sessionCode, restaurantId.toString(), menuData);
            }
          } else {
            setRestaurants(prev => prev.map(r =>
              r.id === restaurantId ? { ...r, menuError: 'No menu info available' } : r
            ));
          }
        } catch (err) {
          console.error('Failed to fetch menu:', err);
          setRestaurants(prev => prev.map(r =>
            r.id === restaurantId ? { ...r, menuError: 'Failed to fetch menu info' } : r
          ));
        } finally {
          setLoadingMenus(prev => {
            const newSet = new Set(prev);
            newSet.delete(restaurantId);
            return newSet;
          });
        }
      }
    }
  };

  if (!currentRestaurant) return null;

  return (
    <div className="relative h-screen w-full overflow-hidden" style={{ backgroundColor: '#f9fafb' }}>
      {/* "YUM!" Explosion Animation */}
      {showYumAnimation && (
        <motion.div
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 3.5, opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
        >
          <div className="text-[10rem] font-black drop-shadow-2xl" style={{ fontFamily: 'Montserrat, sans-serif', color: '#f97316' }}>
            YUM!
          </div>
        </motion.div>
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
          isFlipped={flippedCards.has(currentRestaurant.id)}
          onFlip={() => handleFlip(currentRestaurant.id)}
          isLoadingMenu={loadingMenus.has(currentRestaurant.id)}
        />
      </AnimatePresence>

      {/* Progress indicator */}
      <div className="absolute left-0 right-0 top-6 z-30 px-6">
        <div className="flex justify-between gap-1.5">
          {restaurants.map((_, index) => (
            <motion.div
              key={index}
              className="relative h-1 flex-1 overflow-hidden rounded-full"
              style={{ backgroundColor: '#e5e7eb' }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: index * 0.05 }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: '#f97316' }}
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
          className="mt-2 text-center"
        >
          <span className="text-sm font-medium" style={{ color: '#6b7280' }}>
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
            className="absolute left-8 top-1/3 z-30 rounded-2xl border-4 px-8 py-4 shadow-lg"
            style={{ backgroundColor: '#ffffff', borderColor: '#ef4444' }}
          >
            <span className="text-4xl font-bold" style={{ fontFamily: 'Montserrat, sans-serif', color: '#ef4444' }}>
              NOPE
            </span>
          </motion.div>
        )}
        {direction === 'right' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, rotate: 30 }}
            animate={{ opacity: 1, scale: 1, rotate: 15 }}
            exit={{ opacity: 0 }}
            className="absolute right-8 top-1/3 z-30 rounded-2xl border-4 px-8 py-4 shadow-lg"
            style={{ backgroundColor: '#ffffff', borderColor: '#f97316' }}
          >
            <span className="text-4xl font-bold" style={{ fontFamily: 'Montserrat, sans-serif', color: '#f97316' }}>
              LIKE
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons - ACTUAL BOTTOM with proper positioning */}
      <div className="fixed inset-x-0 bottom-0 z-50" style={{ paddingBottom: '32px', paddingTop: '16px', background: 'linear-gradient(to top, rgba(249, 250, 251, 1) 70%, rgba(249, 250, 251, 0) 100%)' }}>
        <div className="flex items-center justify-center gap-5">
          {/* Dislike Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => handleSwipe('left')}
            className="flex items-center justify-center rounded-full transition-all active:scale-90"
            style={{
              backgroundColor: '#ffffff',
              width: '68px',
              height: '68px',
              border: '3px solid #ef4444',
              boxShadow: '0 8px 24px rgba(239, 68, 68, 0.25)',
            }}
          >
            <X className="h-8 w-8" style={{ color: '#ef4444' }} strokeWidth={2.5} />
          </motion.button>

          {/* Like Button - Primary */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => handleSwipe('right')}
            className="flex items-center justify-center rounded-full transition-all active:scale-90"
            style={{
              backgroundColor: '#f97316',
              width: '76px',
              height: '76px',
              boxShadow: '0 10px 30px rgba(249, 115, 22, 0.45)',
            }}
            animate={{
              boxShadow: [
                '0 10px 30px rgba(249, 115, 22, 0.45)',
                '0 12px 36px rgba(249, 115, 22, 0.6)',
                '0 10px 30px rgba(249, 115, 22, 0.45)',
              ]
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Heart className="h-9 w-9 text-white" strokeWidth={2.5} fill="white" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}

interface SwipeCardProps {
  restaurant: Restaurant;
  onSwipe: (direction: 'left' | 'right') => void;
  direction: 'left' | 'right' | null;
  showInfo: boolean;
  onToggleInfo: () => void;
  isFlipped: boolean;
  onFlip: () => void;
  isLoadingMenu: boolean;
}

function SwipeCard({ restaurant, onSwipe, direction, showInfo, isFlipped, onFlip, isLoadingMenu }: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-30, 30]);
  const opacity = useTransform(x, [-300, -150, 0, 150, 300], [0.5, 1, 1, 1, 0.5]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > 100) {
      onSwipe('right');
    } else if (info.offset.x < -100) {
      onSwipe('left');
    }
  };

  return (
    <motion.div
      className="absolute inset-0 z-20"
      style={{ x, rotate, opacity }}
      drag={isFlipped ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={
        direction
          ? { x: direction === 'left' ? -1000 : 1000, opacity: 0, transition: { duration: 0.4 } }
          : { scale: 1, opacity: 1, x: 0 }
      }
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="relative h-full w-full px-3" style={{ paddingTop: '60px', paddingBottom: '20px' }}>
        {/* 3D perspective container */}
        <div className="h-full w-full overflow-hidden rounded-3xl" style={{ perspective: '1200px', backgroundColor: '#ffffff', boxShadow: '0 20px 60px -15px rgba(0, 0, 0, 0.15)' }}>
          {/* Flip container - both faces always rendered */}
          <div
            className="relative h-full w-full transition-transform duration-500 ease-in-out"
            style={{
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
            }}
          >
            {/* Front face - Beautiful Card View */}
            <div
              className="absolute inset-0 h-full w-full cursor-pointer"
              style={{
                backfaceVisibility: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}
              onClick={onFlip}
            >
              {/* Image Section - Top 65% */}
              <div
                className="relative w-full flex-shrink-0 overflow-hidden rounded-t-3xl"
                style={{ height: '65%' }}
              >
                <img
                  src={restaurant.image}
                  alt={restaurant.name}
                  className="w-full h-full object-cover"
                  style={{ display: 'block' }}
                />
                {/* Subtle gradient for depth */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0) 60%, rgba(0,0,0,0.15) 100%)' }}
                />

                {/* Tap for menu hint - top right */}
                <motion.div
                  className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 backdrop-blur-md shadow-lg"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid rgba(229, 231, 235, 0.5)' }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <RotateCcw className="h-3 w-3" style={{ color: '#f97316' }} />
                  <span className="text-xs font-semibold" style={{ color: '#1C1917' }}>Menu</span>
                </motion.div>

                {/* Trending badge - top left */}
                {restaurant.trending && (
                  <div className="absolute left-3 top-3">
                    <div className="flex items-center gap-1.5 rounded-full px-3 py-1 shadow-lg backdrop-blur-sm" style={{ backgroundColor: 'rgba(249, 115, 22, 0.95)' }}>
                      <TrendingUp className="h-3.5 w-3.5 text-white" />
                      <span className="text-xs text-white font-bold">TRENDING</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Info Section - Bottom 35% with white background */}
              <div
                className="flex-1 flex flex-col p-5 rounded-b-3xl"
                style={{ backgroundColor: '#ffffff' }}
              >
                {/* Rating & Price Row */}
                <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                  <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ backgroundColor: '#f97316' }}>
                    <Star className="h-4 w-4 text-white" fill="white" />
                    <span className="text-sm fon-bold text-white">{restaurant.rating}</span>
                  </div>
                  <span className="text-xs font-medium" style={{ color: '#6b7280' }}>({restaurant.reviewCount})</span>
                  <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: '#f3f4f6', color: '#1C1917' }}>{restaurant.price}</span>
                </div>

                {/* Restaurant Name */}
                <h2 className="text-xl font-bold mb-1.5 flex-shrink-0 leading-tight" style={{ fontFamily: 'Montserrat, sans-serif', color: '#1C1917' }}>
                  {restaurant.name}
                </h2>

                {/* Cuisine & Distance */}
                <div className="flex items-center gap-1.5 flex-shrink-0" style={{ color: '#6b7280' }}>
                  <MapPin className="h-4 w-4" />
                  <span className="text-sm">{restaurant.cuisine} • {restaurant.distance}</span>
                </div>
              </div>
            </div>

            {/* Back face - pre-rotated 180deg so it shows when container rotates */}
            <div
              className="absolute inset-0 h-full w-full flex flex-col cursor-pointer"
              style={{
                backgroundColor: '#ffffff',
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)'
              }}
              onClick={onFlip}
            >
              {/* Header */}
              <div className="p-5 border-b shrink-0" style={{ backgroundColor: '#fff7ed', borderColor: '#fed7aa' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <ChefHat className="h-5 w-5" style={{ color: '#f97316' }} />
                    <h2 className="text-lg font-bold" style={{ fontFamily: 'Montserrat, sans-serif', color: '#1C1917' }}>
                      {restaurant.name}
                    </h2>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onFlip(); }}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                    style={{ backgroundColor: '#f3f4f6', color: '#1C1917' }}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Back
                  </button>
                </div>
                <p className="mt-1 text-[11px]" style={{ color: '#9ca3af' }}>Powered by Yelp AI</p>
              </div>

              {/* Content - centered vertically */}
              <div className="flex-1 flex items-center justify-center p-5 overflow-y-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {isLoadingMenu ? (
                  <motion.div
                    className="flex flex-col items-center justify-center gap-4"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Animated food emoji */}
                    <motion.div
                      animate={{
                        y: [0, -10, 0],
                        rotate: [0, 5, -5, 0]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                      className="text-4xl"
                    >
                      🍽️
                    </motion.div>

                    {/* Spinner */}
                    <div className="relative">
                      <motion.div
                        className="w-12 h-12 rounded-full border-4"
                        style={{ borderColor: '#fef3f2', borderTopColor: '#f97316' }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                    </div>

                    {/* Animated text */}
                    <div className="text-center">
                      <p className="text-sm font-medium" style={{ color: '#1C1917' }}>Asking Yelp AI...</p>
                      <motion.p
                        className="text-xs mt-1"
                        style={{ color: '#6b7280' }}
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        Finding popular dishes at {restaurant.name}
                      </motion.p>
                    </div>
                  </motion.div>
                ) : restaurant.menuData ? (
                  <div className="space-y-4 w-full">
                    {/* If we have an AI response, display it nicely */}
                    {(restaurant.menuData as any).aiResponse ? (
                      <div className="rounded-lg p-4" style={{ backgroundColor: '#f9fafb' }}>
                        <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: '#f97316' }}>
                          Popular Items & Recommendations
                        </h3>
                        <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: '#4b5563' }}>
                          {(restaurant.menuData as any).aiResponse}
                        </p>
                      </div>
                    ) : (
                      /* Fallback to structured categories (for agentic scraping) */
                      <>
                        {restaurant.menuData.highlights && restaurant.menuData.highlights.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {restaurant.menuData.highlights.map((h, i) => (
                              <span key={i} className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: '#fff7ed', color: '#f97316' }}>
                                {h}
                              </span>
                            ))}
                          </div>
                        )}
                        {restaurant.menuData.categories.map((category, idx) => (
                          <div key={idx}>
                            <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: '#f97316' }}>
                              {category.name}
                            </h3>
                            <div className="space-y-2">
                              {category.items.slice(0, 5).map((item, itemIdx) => (
                                <div key={itemIdx} className="flex justify-between items-start gap-4 rounded-lg p-3" style={{ backgroundColor: '#f9fafb' }}>
                                  <div className="flex-1">
                                    <p className="text-sm font-medium" style={{ color: '#1C1917' }}>{item.name}</p>
                                    {item.description && (
                                      <p className="text-xs mt-0.5 line-clamp-2" style={{ color: '#6b7280' }}>{item.description}</p>
                                    )}
                                  </div>
                                  {item.price && (
                                    <span className="text-sm font-semibold shrink-0" style={{ color: '#10b981' }}>{item.price}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                    <ChefHat className="h-12 w-12" style={{ color: '#d1d5db' }} />
                    <div>
                      <p style={{ color: '#6b7280' }}>Menu not available</p>
                      <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
                        {restaurant.menuError || ((restaurant.menuUrl || restaurant.url) ? 'Could not parse menu from page' : 'No URL available')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
import { useState, useEffect, useCallback } from 'react';

export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export type PermissionStatus = 'prompt' | 'granted' | 'denied' | 'unavailable';

export function useGeolocation(autoRequest: boolean = false) {
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('prompt');

  // Check permission status on mount
  useEffect(() => {
    const checkPermission = async () => {
      if (!navigator.permissions) {
        // Permissions API not supported, try to request anyway
        setPermissionStatus('unavailable');
        return;
      }

      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setPermissionStatus(result.state as PermissionStatus);

        // Listen for permission changes
        result.addEventListener('change', () => {
          setPermissionStatus(result.state as PermissionStatus);
          // If permission is granted, automatically get location
          if (result.state === 'granted') {
            requestLocationInternal();
          }
        });
      } catch (err) {
        console.log('Could not check geolocation permission:', err);
        setPermissionStatus('unavailable');
      }
    };

    checkPermission();
  }, []);

  const requestLocationInternal = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setLoading(true);
    setError(null);

    console.log('📍 Requesting geolocation...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('📍 Location received:', position.coords);
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLoading(false);
        setPermissionStatus('granted');
      },
      (err) => {
        console.error('📍 Geolocation error:', err);
        if (err.code === 1) {
          setError('Location permission denied. Please enable location in your browser settings.');
          setPermissionStatus('denied');
        } else if (err.code === 2) {
          setError('Location unavailable. Please try again.');
        } else if (err.code === 3) {
          setError('Location request timed out. Please try again.');
        } else {
          setError(err.message || 'Failed to get location');
        }
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000, // Increased timeout to 10 seconds
        maximumAge: 60000, // Allow cached position up to 1 minute old
      }
    );
  }, []);

  const requestLocation = useCallback(() => {
    console.log('📍 Manual location request triggered');
    requestLocationInternal();
  }, [requestLocationInternal]);

  // Auto-request on mount if enabled
  useEffect(() => {
    if (autoRequest) {
      // Small delay to let the component mount first
      const timer = setTimeout(() => {
        console.log('📍 Auto-requesting location...');
        requestLocationInternal();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoRequest, requestLocationInternal]);

  return {
    location,
    loading,
    error,
    permissionStatus,
    requestLocation,
  };
}


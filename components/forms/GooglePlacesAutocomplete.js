// /components/forms/GooglePlacesAutocomplete.js
'use client';
import { useState, useEffect, useRef } from 'react';

const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-places';
let googleMapsLoaderPromise = null;

const loadGoogleMaps = () => {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.maps?.places) return Promise.resolve();

  if (!googleMapsLoaderPromise) {
    googleMapsLoaderPromise = new Promise((resolve, reject) => {
      const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', () => reject(new Error('Google Maps failed to load')));
        return;
      }

      const script = document.createElement('script');
      script.id = GOOGLE_MAPS_SCRIPT_ID;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Google Maps failed to load'));
      document.head.appendChild(script);
    });
  }

  return googleMapsLoaderPromise;
};

export default function GooglePlacesAutocomplete({ onAddressSelect, defaultValue = '' }) {
  const [value, setValue] = useState(defaultValue);
  const autocompleteRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    let isMounted = true;
    loadGoogleMaps()
      .then(() => {
        if (isMounted) {
          initializeAutocomplete();
        }
      })
      .catch((error) => {
        console.error('Failed to load Google Places API:', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const initializeAutocomplete = () => {
    if (!inputRef.current || !window.google) return;

    autocompleteRef.current = new window.google.maps.places.Autocomplete(
      inputRef.current,
      {
        types: ['address'],
        componentRestrictions: { country: 'us' },
      }
    );

    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        setValue(place.formatted_address);

        // Extract address components
        let county = '';
        let state = '';
        let stateShort = '';
        let city = '';
        let zipcode = '';

        if (place.address_components) {
          for (const component of place.address_components) {
            const types = component.types;
            if (types.includes('administrative_area_level_2')) {
              // County
              county = component.long_name;
            }
            if (types.includes('administrative_area_level_1')) {
              // State
              state = component.long_name;
              stateShort = component.short_name;
            }
            if (types.includes('locality')) {
              // City
              city = component.long_name;
            }
            if (types.includes('postal_code')) {
              // Zipcode
              zipcode = component.long_name;
            }
          }
        }

        onAddressSelect({
          address: place.formatted_address,
          latitude: lat,
          longitude: lng,
          county: county,
          state: state,
          stateShort: stateShort,
          city: city,
          zipcode: zipcode,
        });
      }
    });
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Enter property address..."
      className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-[#472F97] focus:border-[#472F97] outline-none transition-all text-sm"
    />
  );
}

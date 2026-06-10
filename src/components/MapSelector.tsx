import React, { useState, useEffect } from 'react';
import { APIProvider, Map as GoogleMap, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { MapPin, Info, Check, Search, Compass, Sparkles } from 'lucide-react';
import { LocationCoords } from '../types.ts';

interface MapSelectorProps {
  selectedCoords: LocationCoords;
  onSelectCoords: (coords: LocationCoords) => void;
  locationName: string;
  onLocationSelectText?: (text: string) => void;
}

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY' && API_KEY.trim() !== '';

// Realistic landmarks around Yangon for our simulated map
interface Landmark {
  name: string;
  coords: LocationCoords;
  type: string;
  color: string;
}

const YANGON_LANDMARKS: Landmark[] = [
  { name: 'Shwedagon Pagoda (ရွှေတိဂုံစေတီတော်)', coords: { lat: 16.7983, lng: 96.1497 }, type: 'culture', color: 'bg-amber-500' },
  { name: 'Inya Lake (အင်းလျားကန်)', coords: { lat: 16.8409, lng: 96.1561 }, type: 'lake', color: 'bg-blue-500' },
  { name: 'Kandawgyi Lake (ကန်တော်ကြီး)', coords: { lat: 16.7944, lng: 96.1664 }, type: 'lake', color: 'bg-sky-500' },
  { name: 'Sule Pagoda (ဆူးလေဘုရား - Downtown)', coords: { lat: 16.7746, lng: 96.1587 }, type: 'city', color: 'bg-yellow-600' },
  { name: 'Hledan Junction (လှည်းတန်းဆုံ)', coords: { lat: 16.8277, lng: 96.1306 }, type: 'transit', color: 'bg-violet-500' },
  { name: 'Junction City Mall (ဂျန်းရှင်းစီးတီး)', coords: { lat: 16.7788, lng: 96.1517 }, type: 'shop', color: 'bg-rose-500' },
  { name: 'Sanchaung Township (စမ်းချောင်း)', coords: { lat: 16.8080, lng: 96.1315 }, type: 'residential', color: 'bg-emerald-500' },
  { name: 'MICT Park (လှိုင်နည်းပညာ)', coords: { lat: 16.8488, lng: 96.1285 }, type: 'tech', color: 'bg-blue-600' },
];

export default function MapSelector({ selectedCoords, onSelectCoords, locationName, onLocationSelectText }: MapSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Preset search or location click
  const handleSelectPreset = (landmark: Landmark) => {
    onSelectCoords(landmark.coords);
    if (onLocationSelectText) {
      onLocationSelectText(`${landmark.name}, Yangon`);
    }
  };

  // Searching inside simulated presets
  const filteredPresets = YANGON_LANDMARKS.filter(landmark =>
    landmark.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm" id="map-selector-container">
      {/* Header Info explaining status */}
      {hasValidKey && (
        <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <MapPin className="text-blue-600 h-5 w-5" />
            <div>
              <h4 className="text-sm font-semibold text-gray-800">
                Customer Location Pin (မြေပုံညွှန်ပြချက်)
              </h4>
              <p className="text-xs text-gray-500 font-mono">
                Coordinates: {selectedCoords.lat.toFixed(4)}°N, {selectedCoords.lng.toFixed(4)}°E
              </p>
            </div>
          </div>

          <div>
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-100">
              <Check className="h-3 w-3" /> Live Google Maps
            </span>
          </div>
        </div>
      )}

      {hasValidKey ? (
        /* ======================== REAL GOOGLE MAP AREA ======================== */
        <div className="relative h-96 w-full" id="real-google-map-box">
          <APIProvider apiKey={API_KEY} version="weekly">
            <GoogleMap
              defaultCenter={selectedCoords}
              center={selectedCoords}
              defaultZoom={13}
              mapId="COMPUTER_SERVICE_MAP"
              onClick={(e) => {
                if (e.detail && e.detail.latLng) {
                  onSelectCoords({
                    lat: e.detail.latLng.lat,
                    lng: e.detail.latLng.lng,
                  });
                }
              }}
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              style={{ width: '100%', height: '100%' }}
            >
              <AdvancedMarker position={selectedCoords}>
                <Pin background="#2563EB" glyphColor="#fff" />
              </AdvancedMarker>
            </GoogleMap>
          </APIProvider>
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md border border-gray-100 p-2.5 rounded-xl shadow-lg max-w-sm pointer-events-auto">
            <p className="text-[11px] text-gray-600 leading-relaxed font-sans flex items-start gap-1">
              <Info className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
              <span>Click anywhere on the map to pin the technician dispatch target.</span>
            </p>
          </div>
        </div>
      ) : (
        /* ======================== SIMPLE SEARCHABLE PRESETS LIST ======================== */
        <div className="p-4 flex flex-col gap-3" id="simulated-map-box">
          <div className="flex items-center gap-1.5 pb-1">
            <Compass className="h-4 w-4 text-blue-600 animate-pulse" />
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider select-none">
              Core Landmarks & Townships (စေလွှတ်ရန်နေရာရွေးချယ်ရန်)
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              id="preset-search-input"
              placeholder="Search townships or popular areas (e.g. Sanchaung, Hledan, Sule)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-250 pl-9 pr-4 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1" id="presets-list">
            {filteredPresets.map((landmark, idx) => {
              const isSelected = selectedCoords.lat === landmark.coords.lat && selectedCoords.lng === landmark.coords.lng;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectPreset(landmark)}
                  className={`flex items-center justify-between text-left p-2.5 border rounded-xl transition-all cursor-pointer group ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/50'
                      : 'border-gray-100 hover:border-blue-200 hover:bg-blue-50/10'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <p className={`text-xs font-semibold truncate ${isSelected ? 'text-blue-700 font-bold' : 'text-gray-700 group-hover:text-blue-700'}`}>
                      {landmark.name}
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono truncate animate-fade-in">
                      Lat: {landmark.coords.lat.toFixed(4)}, Lng: {landmark.coords.lng.toFixed(4)}
                    </p>
                  </div>
                  <span className={`shrink-0 text-blue-500 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <Check className="h-4 w-4" />
                  </span>
                </button>
              );
            })}
            {filteredPresets.length === 0 && (
              <div className="col-span-full py-8 text-center text-xs text-gray-400">
                No matching location presets found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

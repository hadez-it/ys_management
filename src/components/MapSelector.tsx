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
  const [activeTab, setActiveTab] = useState<'interactive' | 'presets'>('interactive');

  // Coordinates bounds in Yangon for the simulated map rendering
  const minLat = 16.75;
  const maxLat = 16.89;
  const minLng = 96.10;
  const maxLng = 96.22;

  // Convert lat/lng to percentage coordinates on our 2D canvas of Yangon
  const getPercentagePos = (coords: LocationCoords) => {
    const yPct = 100 - ((coords.lat - minLat) / (maxLat - minLat)) * 100;
    const xPct = ((coords.lng - minLng) / (maxLng - minLng)) * 100;
    return {
      x: Math.min(Math.max(xPct, 2), 98),
      y: Math.min(Math.max(yPct, 2), 98),
    };
  };

  // Convert back from card mouse clicks into lat/lng
  const handleSimulatedMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const xPct = x / rect.width;
    const yPct = 1 - y / rect.height; // invert y

    const calculatedLat = minLat + yPct * (maxLat - minLat);
    const calculatedLng = minLng + xPct * (maxLng - minLng);

    // Format to 4 decimals
    onSelectCoords({
      lat: Math.round(calculatedLat * 10000) / 10000,
      lng: Math.round(calculatedLng * 10000) / 10000
    });
  };

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
          {hasValidKey ? (
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-100">
              <Check className="h-3 w-3" /> Live Google Maps
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-blue-100">
              <Sparkles className="h-3 w-3 animate-pulse" /> Sandbox Map Active
            </span>
          )}
        </div>
      </div>

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
        /* ======================== LUXURIOUS SIMULATED MAP AREA ======================== */
        <div className="col-span-1" id="simulated-map-box">
          <div className="flex border-b border-gray-100 p-2 gap-2 bg-white">
            <button
              type="button"
              id="btn-interactive-map"
              onClick={() => setActiveTab('interactive')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200 ${
                activeTab === 'interactive'
                  ? 'bg-blue-50/80 text-blue-700 font-semibold border border-blue-100/30'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Compass className="h-4 w-4" /> Interactive Map Grid
            </button>
            <button
              type="button"
              id="btn-presets"
              onClick={() => setActiveTab('presets')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200 ${
                activeTab === 'presets'
                  ? 'bg-blue-50/80 text-blue-700 font-semibold border border-blue-100/30'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Search className="h-4 w-4" /> Core Landmarks & Townships
            </button>
          </div>

          {activeTab === 'interactive' ? (
            <div className="p-4 bg-gray-50 flex flex-col gap-3">
              {/* Map Canvas Frame */}
              <div
                id="interactive-canvas"
                onClick={handleSimulatedMapClick}
                className="relative h-64 bg-slate-900 rounded-xl overflow-hidden cursor-crosshair border border-slate-700 shadow-inner select-none transition-all"
                style={{
                  backgroundImage: 'radial-gradient(rgba(147, 197, 253, 0.15) 1.5px, transparent 1.5px)',
                  backgroundSize: '16px 16px',
                }}
              >
                {/* Simulated Yangon Waterbodies */}
                {/* Inya Lake */}
                <div className="absolute top-[18%] left-[45%] w-[18%] h-[12%] rounded-full bg-blue-950/70 opacity-85 border border-blue-700 blur-[2px] pointer-events-none flex items-center justify-center">
                  <span className="text-[9px] text-blue-400 font-medium">Inya Lake</span>
                </div>
                {/* Kandawgyi Lake */}
                <div className="absolute top-[55%] left-[55%] w-[12%] h-[8%] rounded-full bg-blue-950/70 opacity-85 border border-sky-700 blur-[2px] pointer-events-none flex items-center justify-center">
                  <span className="text-[9px] text-sky-400 font-medium">Kandawgyi</span>
                </div>

                {/* Grid Grid Coordinates */}
                <div className="absolute left-2 top-2 text-[10px] text-gray-500 font-mono">Yangon Sector Grid</div>
                <div className="absolute inset-x-0 bottom-0 py-1 bg-slate-950/50 flex justify-between px-3 text-[9px] text-gray-400 font-mono font-medium">
                  <span>96.10°E (Hlaing River)</span>
                  <span>96.22°E (Yangon River)</span>
                </div>

                {/* Major Streets (Pyay Road & Kabar Aye Pagoda Rd) */}
                {/* Pyay Road */}
                <div className="absolute top-0 bottom-0 left-[38%] w-[2px] bg-slate-700/60 rotate-[-12deg] pointer-events-none flex items-end">
                  <span className="text-[8px] text-gray-500 font-sans tracking-widest pl-1 mb-8 text-nowrap rotate-[12deg]">Pyay Road</span>
                </div>
                {/* Kabar Aye Pagoda Road */}
                <div className="absolute top-0 bottom-0 left-[62%] w-[2px] bg-slate-700/60 rotate-[-8deg] pointer-events-none flex items-end">
                  <span className="text-[8px] text-gray-500 font-sans tracking-widest pl-1 mb-16 text-nowrap rotate-[8deg]">Kabar Aye Rd</span>
                </div>

                {/* Static Landmark Pins for navigation context */}
                {YANGON_LANDMARKS.map((landmark, idx) => {
                  const pos = getPercentagePos(landmark.coords);
                  return (
                    <div
                      key={idx}
                      className="absolute group -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
                      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    >
                      <div className={`w-2 h-2 rounded-full ${landmark.color} shadow-lg ring-2 ring-slate-850 scale-90 group-hover:scale-110 transition-transform`} />
                      <span className="text-[8px] font-sans text-gray-400 bg-slate-950/80 px-1 rounded mt-0.5 pointer-events-none whitespace-nowrap">
                        {landmark.name.split(' (')[0]}
                      </span>
                    </div>
                  );
                })}

                {/* Selected Active Customer Pin */}
                {(() => {
                  const activePos = getPercentagePos(selectedCoords);
                  return (
                    <div
                      id="active-simulated-pin"
                      className="absolute -translate-x-1/2 -translate-y-[85%] flex flex-col items-center pointer-events-none animate-bounce"
                      style={{ left: `${activePos.x}%`, top: `${activePos.y}%` }}
                    >
                      <div className="bg-rose-500 text-white rounded-full p-1.5 shadow-xl border-2 border-white ring-4 ring-rose-500/30 flex items-center justify-center">
                        <MapPin className="h-5 w-5 fill-white text-rose-500" />
                      </div>
                      <div className="bg-slate-950 text-white text-[10px] py-1 px-2 rounded-md font-sans font-medium mt-1.5 border border-slate-700 shadow-xl whitespace-nowrap">
                        Customer Repair Target Here
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="flex items-start gap-1 px-1">
                <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-gray-600 leading-relaxed">
                  <strong className="text-gray-700">Sandbox Click:</strong> Tap anywhere in the coordinate grid above to place the customer's repair location. We will dispatch the technician to this quadrant.
                </p>
              </div>
            </div>
          ) : (
            /* Presets Search Tab */
            <div className="p-4 bg-gray-50 flex flex-col gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  id="preset-search-input"
                  placeholder="Search townships or popular areas (e.g. Bahan, Hledan)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-gray-200 pl-9 pr-4 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1" id="presets-list">
                {filteredPresets.map((landmark, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPreset(landmark)}
                    className="flex items-center justify-between text-left p-2.5 bg-white border border-gray-100 hover:border-blue-200 rounded-xl hover:bg-blue-50/30 transition-all cursor-pointer group"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-semibold text-gray-700 truncate group-hover:text-blue-700">
                        {landmark.name}
                      </p>
                      <p className="text-[10px] text-gray-400 font-mono truncate">
                        Lat: {landmark.coords.lat}, Lng: {landmark.coords.lng}
                      </p>
                    </div>
                    <span className="shrink-0 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Check className="h-4 w-4" />
                    </span>
                  </button>
                ))}
                {filteredPresets.length === 0 && (
                  <div className="col-span-full py-8 text-center text-xs text-gray-400">
                    No matching location presets found.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick instructions to add live key */}
          <div className="px-4 py-3 bg-blue-50/50 border-t border-blue-50 flex items-start gap-2.5">
            <Sparkles className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-gray-600 leading-relaxed font-sans">
              <strong>To activate real satellite Google Maps:</strong> 1. Get an API key from Google Cloud Console. 2. Click the gear icon (⚙️) on top-right corner &rarr; <strong>Secrets</strong> &rarr; Add <code>GOOGLE_MAPS_PLATFORM_KEY</code> as key and save your token. The application builds automatically.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

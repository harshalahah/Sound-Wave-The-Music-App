import { useState, useEffect } from 'react';
import DynamicBackground from './components/DynamicBackground';
import FloatingConsole from './components/FloatingConsole';
import { Search as SearchIcon, Library, X, Loader2, Play } from 'lucide-react';

export const getHighResThumbnail = (track) => {
  if (!track) return "";
  if (track.thumbnails && track.thumbnails.length > 0) return track.thumbnails[track.thumbnails.length - 1].url;
  if (track.thumbnail_url) return track.thumbnail_url;
  return "";
};

export const getArtistsText = (track) => {
  if (!track) return "Unknown Artist";
  if (track.artists && Array.isArray(track.artists)) return track.artists.map(a => a.name).join(', ');
  if (track.artist) return track.artist;
  return "Unknown Artist";
};

export default function App() {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [primaryQueue, setPrimaryQueue] = useState([]);
  const [playbackHistory, setPlaybackHistory] = useState([]);
  
  // Last.fm Radio State
  const [radioMix, setRadioMix] = useState({ seed_track: "Nothing yet", recommendations: [] });
  const [loadingRadio, setLoadingRadio] = useState(false);

  // Home Screen State
  const [homeFeed, setHomeFeed] = useState([]);
  const [recentTracks, setRecentTracks] = useState([]);

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        const [homeRes, recentRes] = await Promise.all([
          fetch('/api/music/home'),
          fetch('/api/history/recent')
        ]);
        const homeData = await homeRes.json();
        const recentData = await recentRes.json();
        setHomeFeed(homeData.trending || []);
        setRecentTracks(recentData.results || []);
      } catch (err) { console.error(err); }
    };
    fetchHomeData();
  }, [currentTrack]); // Refresh recents implicitly when track changes

  // Library State
  const [showLibrary, setShowLibrary] = useState(false);
  const [likedSongs, setLikedSongs] = useState([]);
  useEffect(() => {
    const fetchRadio = async () => {
      setLoadingRadio(true);
      try {
        const res = await fetch('/api/recommendations/');
        const data = await res.json();
        if (data.recommendations) {
          setRadioMix(data);
        }
      } catch (err) {
        console.error("Radio fetch error", err);
      } finally {
        setLoadingRadio(false);
      }
    };
    
    // Wait 1s for the POST history endpoint to finish if a new playback triggered this
    const timer = setTimeout(() => fetchRadio(), 1000);
    return () => clearTimeout(timer);
  }, [currentTrack]);
  
  // Search Overlay State
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
        if (e.key === 'Escape' && isSearching) {
          setIsSearching(false);
          document.activeElement.blur();
        }
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('toggle-playback'));
      } else if (e.key === '/') {
        e.preventDefault();
        setIsSearching(true);
      } else if (e.key === 'Escape') {
        setIsSearching(false);
        setShowLibrary(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearching, showLibrary]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setLoadingSearch(true);
    try {
      const res = await fetch(`/api/music/search?query=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoadingSearch(false);
    }
  };

  const toggleLibrary = async () => {
    if (!showLibrary) {
      try {
        const res = await fetch('/api/library/liked');
        const data = await res.json();
        setLikedSongs(data.results || []);
      } catch (err) { console.error(err); }
    }
    setShowLibrary(!showLibrary);
    setIsSearching(false);
  };

  const playTrack = async (track, contextArray = [], isFromSearch = false) => {
    if (currentTrack) {
      // Record current track in playback history
      setPlaybackHistory(prev => [...prev, currentTrack]);
    }
    setCurrentTrack(track);
    setIsSearching(false);
    setShowLibrary(false);
    
    // Build primary queue based on where the user clicked
    // If it's a search result, do not queue the remaining search results
    if (isFromSearch) {
      setPrimaryQueue([]);
    } else {
      const index = contextArray.findIndex(t => t.videoId === track.videoId);
      if (index !== -1) {
        setPrimaryQueue(contextArray.slice(index + 1));
      } else {
        setPrimaryQueue([]); 
      }
    }
  };

  const handleNextTrack = () => {
    if (primaryQueue.length > 0) {
      const nextTrack = primaryQueue[0];
      if (currentTrack) setPlaybackHistory(prev => [...prev, currentTrack]);
      setPrimaryQueue(primaryQueue.slice(1));
      setCurrentTrack(nextTrack);
    } else if (radioMix.recommendations.length > 0) {
      const nextTrack = radioMix.recommendations[0];
      if (currentTrack) setPlaybackHistory(prev => [...prev, currentTrack]);
      setRadioMix({ ...radioMix, recommendations: radioMix.recommendations.slice(1) });
      setCurrentTrack(nextTrack);
    } else {
      setCurrentTrack(null);
    }
  };

  const handlePrevTrack = () => {
    if (playbackHistory.length > 0) {
      const prevTrack = playbackHistory[playbackHistory.length - 1];
      setPlaybackHistory(prev => prev.slice(0, -1));
      
      // Move current track back into the front of the queue
      if (currentTrack) {
        setPrimaryQueue(prev => [currentTrack, ...prev]);
      }
      setCurrentTrack(prevTrack);
    }
  };
  return (
    <div className="relative min-h-screen w-full font-sans text-white selection:bg-purple-500/30 font-['Plus_Jakarta_Sans']">
      {/* Background dynamically updates using the highest res thumbnail */}
      <DynamicBackground imageUrl={getHighResThumbnail(currentTrack)} />
      
      {/* Frosted Floating Header */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-7xl z-30 px-6 py-4 flex items-center justify-between rounded-2xl glass-card border border-white/10 shadow-xl pointer-events-auto">
        <h1 className="text-2xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-white to-cyan-400 font-['Outfit'] select-none">
          Sound Wave
        </h1>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setIsSearching(!isSearching);
              setShowLibrary(false);
            }}
            className={`w-10 h-10 flex flex-shrink-0 items-center justify-center rounded-full backdrop-blur-md border border-white/10 transition-all duration-300 active:scale-95 cursor-pointer ${isSearching ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)] border-purple-400' : 'bg-white/5 hover:bg-white/10 hover:scale-105'}`}
          >
            {isSearching ? <X size={18} /> : <SearchIcon size={18} />}
          </button>
          <button 
            onClick={toggleLibrary}
            className={`w-10 h-10 flex flex-shrink-0 items-center justify-center rounded-full backdrop-blur-md border border-white/10 transition-all duration-300 active:scale-95 cursor-pointer ${showLibrary ? 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] border-cyan-400' : 'bg-white/5 hover:bg-white/10 hover:scale-105'}`}
          >
            {showLibrary ? <X size={18} /> : <Library size={18} />}
          </button>
        </div>
      </nav>

      {/* === SEARCH OVERLAY === */}
      {isSearching && (
        <div className="fixed inset-0 z-20 bg-black/85 backdrop-blur-3xl pt-32 px-8 overflow-y-auto pb-40">
          <form onSubmit={handleSearch} className="max-w-3xl mx-auto mb-12">
            <div className="relative">
              <input 
                autoFocus
                className="w-full bg-white/5 border border-white/10 text-2xl md:text-3xl font-semibold text-white rounded-3xl py-5 pl-8 pr-28 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all duration-300 placeholder:text-white/20 shadow-2xl font-['Outfit']"
                placeholder="Search artists or tracks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 bg-purple-500 hover:bg-purple-600 text-white px-5 py-2.5 rounded-2xl text-sm font-semibold tracking-tight transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg shadow-purple-500/20 cursor-pointer">
                Search
              </button>
            </div>
          </form>

          <div className="max-w-3xl mx-auto">
            {loadingSearch && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-purple-500 w-12 h-12" /></div>}
            
            <div className="flex flex-col gap-3 relative z-50">
              {searchResults.map((track) => (
                <div 
                  key={track.videoId} 
                  onClick={() => playTrack(track, searchResults, true)}
                  className="flex items-center gap-4 p-4 rounded-[20px] bg-white/5 hover:bg-white/10 hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)] transition-all duration-300 cursor-pointer border border-white/5 hover:border-white/15 hover:scale-[1.01] active:scale-[0.99] group"
                >
                  <div className="relative w-16 h-16 rounded-[14px] overflow-hidden flex-shrink-0 shadow-lg">
                    <img src={track.thumbnails[0]?.url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play fill="white" size={20} className="text-white" />
                    </div>
                  </div>
                  <div className="flex flex-col flex-1 truncate">
                    <span className="text-lg font-semibold text-white truncate group-hover:text-purple-400 transition-colors font-['Outfit']">{track.title}</span>
                    <span className="text-white/50 text-sm truncate font-semibold mt-0.5">{getArtistsText(track)}</span>
                  </div>
                  <span className="text-white/40 text-sm hidden md:block font-bold tracking-wider bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">{track.duration}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* === LIBRARY OVERLAY === */}
      {showLibrary && (
        <div className="fixed inset-0 z-20 bg-black/85 backdrop-blur-3xl pt-32 px-8 overflow-y-auto pb-40">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-10 flex items-center gap-4 font-['Outfit'] select-none">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
              Liked Tracks
            </h2>
            
            <div className="flex flex-col gap-3 relative z-50">
              {likedSongs.length === 0 ? (
                <div className="text-white/40 text-lg font-semibold mt-10 text-center py-20 border border-dashed border-white/10 rounded-[32px] bg-white/5">
                  <p className="mb-2">Your library is currently empty.</p>
                  <p className="text-sm font-normal text-white/30">Tap the heart icon in the music player to add tracks here.</p>
                </div>
              ) : (
                likedSongs.map((track) => (
                  <div 
                    key={track.videoId} 
                    onClick={() => playTrack(track, likedSongs)}
                    className="flex items-center gap-4 p-4 rounded-[20px] bg-white/5 hover:bg-white/10 hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)] transition-all duration-300 cursor-pointer border border-white/5 hover:border-white/15 hover:scale-[1.01] active:scale-[0.99] group"
                  >
                    <div className="relative w-16 h-16 rounded-[14px] overflow-hidden flex-shrink-0 shadow-lg">
                      <img src={track.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play fill="white" size={20} className="text-white" />
                      </div>
                    </div>
                    <div className="flex flex-col flex-1 truncate">
                      <span className="text-lg font-semibold text-white truncate group-hover:text-cyan-400 transition-colors font-['Outfit']">{track.title}</span>
                      <span className="text-white/50 text-sm truncate font-semibold mt-0.5">{track.artist}</span>
                    </div>
                    <span className="text-white/40 text-sm hidden md:block font-bold tracking-wider bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">{track.duration}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* === MAIN CONTENT (Hidden when searching) === */}
      {!isSearching && !showLibrary && (
        <main className="relative z-10 p-8 pt-28 h-screen overflow-y-auto no-scrollbar pb-40 max-w-7xl mx-auto w-full">
          
          {/* Recently Played */}
          {recentTracks.length > 0 && (
            <section className="mb-14">
              <h2 className="text-2xl font-extrabold mb-6 tracking-tight text-white/90 font-['Outfit']">Jump back in</h2>
              <div className="flex gap-6 overflow-x-auto no-scrollbar pb-4 -mx-8 px-8 snap-x">
                {recentTracks.map((track, i) => (
                  <div key={i} onClick={() => playTrack(track, recentTracks)} className="min-w-[150px] md:min-w-[190px] group cursor-pointer snap-start">
                    <div className="w-full aspect-square rounded-[24px] overflow-hidden mb-3.5 relative shadow-2xl border border-white/5 transition-all duration-300 group-hover:border-white/15">
                      <img src={getHighResThumbnail(track)} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <div className="w-12 h-12 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white shadow-xl scale-90 group-hover:scale-100 transition-transform duration-300">
                          <Play fill="white" size={24} className="ml-1" />
                        </div>
                      </div>
                    </div>
                    <h3 className="font-bold text-white/90 group-hover:text-white transition-colors truncate pl-1 font-['Outfit']">{track.title}</h3>
                    <p className="text-white/50 text-xs font-semibold mt-0.5 truncate pl-1">{getArtistsText(track)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Popular / Trending */}
          {homeFeed.length > 0 && (
            <section className="mb-14">
              <h2 className="text-2xl font-extrabold mb-6 tracking-tight text-white/90 font-['Outfit']">Trending Now</h2>
              <div className="flex gap-6 overflow-x-auto no-scrollbar pb-4 -mx-8 px-8 snap-x">
                {homeFeed.map((track, i) => (
                  <div key={i} onClick={() => playTrack(track, homeFeed)} className="min-w-[150px] md:min-w-[190px] group cursor-pointer snap-start">
                    <div className="w-full aspect-square rounded-[24px] overflow-hidden mb-3.5 relative shadow-2xl border border-white/5 transition-all duration-300 group-hover:border-white/15">
                      <img src={getHighResThumbnail(track)} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <div className="w-12 h-12 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white shadow-xl scale-90 group-hover:scale-100 transition-transform duration-300">
                          <Play fill="white" size={24} className="ml-1" />
                        </div>
                      </div>
                    </div>
                    <h3 className="font-bold text-white/90 group-hover:text-white transition-colors truncate pl-1 font-['Outfit']">{track.title}</h3>
                    <p className="text-white/50 text-xs font-semibold mt-0.5 truncate pl-1">{getArtistsText(track)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* AI Radio */}
          <section className="mb-16">
            <h2 className="text-2xl font-extrabold mb-8 flex items-center gap-3.5 text-white/90 font-['Outfit']">
              <span className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_15px_rgba(6,182,212,0.9)]" />
              {radioMix.seed_track === "Nothing yet" ? "AI Radio Mix" : `Radio based on ${radioMix.seed_track}`}
            </h2>
            
            {loadingRadio && <div className="text-white/50 text-sm font-semibold flex gap-2.5 items-center mb-6 pl-1"><Loader2 className="animate-spin w-4 h-4 text-purple-400"/> Curating a custom frequency...</div>}
            
            {!loadingRadio && radioMix.recommendations.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {radioMix.recommendations.map((track, i) => (
                  <div 
                    key={i} 
                    onClick={() => playTrack(track, radioMix.recommendations)}
                    className="aspect-[4/3] rounded-[32px] bg-white/5 border border-white/5 hover:border-purple-500/40 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(168,85,247,0.15)] transition-all duration-500 cursor-pointer p-6 flex flex-col justify-end relative overflow-hidden group shadow-2xl"
                  >
                    <img src={getHighResThumbnail(track)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-75 transition-all duration-700 blur-[1px] group-hover:blur-0 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
                    
                    <h3 className="font-extrabold text-xl md:text-2xl relative z-10 tracking-tight text-white drop-shadow-xl truncate group-hover:text-purple-300 transition-colors font-['Outfit']">{track.title}</h3>
                    <p className="text-white/70 text-sm relative z-10 truncate font-semibold mt-0.5 pl-0.5">{getArtistsText(track)}</p>
                    
                    <span className="absolute top-4 right-4 bg-white/10 backdrop-blur-md border border-white/10 text-white/95 px-3 py-1 rounded-full text-xs font-bold shadow-lg z-10 tracking-wide">
                      {track.lastfm_match === "Auto-Mix" ? "Mix" : `${track.lastfm_match} Match`}
                    </span>
                  </div>
                ))}
              </div>
            )}
            
            {!loadingRadio && radioMix.recommendations.length === 0 && (
               <div className="w-full h-44 rounded-[32px] border border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center text-white/40 gap-2 p-6 shadow-2xl">
                 <p className="font-bold text-lg font-['Outfit']">Awaiting seed track</p>
                 <p className="text-sm font-semibold max-w-xs text-center leading-relaxed">Play any song from trending or search to automatically initialize your AI Radio flow!</p>
               </div>
            )}
          </section>
        </main>
      )}

      {/* Floating Audio Console */}
      {currentTrack && (
        <FloatingConsole 
          track={currentTrack} 
          onTrackEnded={handleNextTrack} 
          onTrackPrev={handlePrevTrack} 
        />
      )}
    </div>
  );
}

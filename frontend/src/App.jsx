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

  const playTrack = async (track, contextArray = []) => {
    setCurrentTrack(track);
    setIsSearching(false);
    setShowLibrary(false);
    
    // Build primary queue based on where the user clicked
    const index = contextArray.findIndex(t => t.videoId === track.videoId);
    if (index !== -1) {
      setPrimaryQueue(contextArray.slice(index + 1));
    } else {
      setPrimaryQueue([]); 
    }
  };

  const handleNextTrack = () => {
    if (primaryQueue.length > 0) {
      const nextTrack = primaryQueue[0];
      setPrimaryQueue(primaryQueue.slice(1));
      setCurrentTrack(nextTrack);
    } else if (radioMix.recommendations.length > 0) {
      const nextTrack = radioMix.recommendations[0];
      setRadioMix({ ...radioMix, recommendations: radioMix.recommendations.slice(1) });
      setCurrentTrack(nextTrack);
    } else {
      setCurrentTrack(null);
    }
  };  
  return (
    <div className="relative min-h-screen w-full font-sans text-white selection:bg-purple-500/30 font-['Inter']">
      {/* Background dynamically updates using the highest res thumbnail */}
      <DynamicBackground imageUrl={getHighResThumbnail(currentTrack)} />
      
      <nav className="fixed top-0 w-full z-30 px-8 py-6 flex items-center justify-between pointer-events-none">
        <h1 className="text-2xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
          Equinox
        </h1>
        <div className="flex items-center gap-4 pointer-events-auto">
          <button 
            onClick={() => setIsSearching(!isSearching)}
            className={`w-10 h-10 flex flex-shrink-0 items-center justify-center rounded-full backdrop-blur-md border border-white/10 transition-colors ${isSearching ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10'}`}
          >
            {isSearching ? <X size={18} /> : <SearchIcon size={18} />}
          </button>
          <button 
            onClick={toggleLibrary}
            className={`w-10 h-10 flex flex-shrink-0 items-center justify-center rounded-full backdrop-blur-md border border-white/10 transition-colors ${showLibrary ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10'}`}
          >
            {showLibrary ? <X size={18} /> : <Library size={18} />}
          </button>
        </div>
      </nav>

      {/* === SEARCH OVERLAY === */}
      {isSearching && (
        <div className="fixed inset-0 z-20 bg-black/70 backdrop-blur-3xl pt-28 px-8 overflow-y-auto pb-40">
          <form onSubmit={handleSearch} className="max-w-3xl mx-auto mb-10">
            <input 
              autoFocus
              className="w-full bg-transparent border-b-2 border-white/10 text-4xl md:text-5xl font-bold text-white focus:outline-none focus:border-purple-500 pb-4 transition-colors placeholder:text-white/20"
              placeholder="Search artists or tracks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>

          <div className="max-w-3xl mx-auto">
            {loadingSearch && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-purple-500 w-12 h-12" /></div>}
            
            <div className="flex flex-col gap-2 relative z-50">
              {searchResults.map((track) => (
                <div 
                  key={track.videoId} 
                  onClick={() => playTrack(track, searchResults)}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border border-white/5 hover:border-white/20 group"
                >
                  <img src={track.thumbnails[0]?.url} alt="" className="w-16 h-16 rounded-xl object-cover shadow-lg" />
                  <div className="flex flex-col flex-1 truncate">
                    <span className="text-lg font-semibold text-white truncate drop-shadow-md">{track.title}</span>
                    <span className="text-white/60 text-sm truncate">{getArtistsText(track)}</span>
                  </div>
                  <span className="text-white/40 text-sm hidden md:block">{track.duration}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* === LIBRARY OVERLAY === */}
      {showLibrary && (
        <div className="fixed inset-0 z-20 bg-black/80 backdrop-blur-2xl pt-28 px-8 overflow-y-auto pb-40">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-10 flex items-center gap-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round" className="text-red-500"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
              Liked Songs
            </h2>
            
            <div className="flex flex-col gap-2 relative z-50">
              {likedSongs.length === 0 ? (
                <div className="text-white/50 text-xl font-medium mt-10">You haven't liked any songs yet. Play a song and tap the heart icon!</div>
              ) : (
                likedSongs.map((track) => (
                  <div 
                    key={track.videoId} 
                    onClick={() => playTrack(track, likedSongs)}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border border-white/5 hover:border-white/20"
                  >
                    <img src={track.thumbnail_url} alt="" className="w-16 h-16 rounded-xl object-cover shadow-lg" />
                    <div className="flex flex-col flex-1 truncate">
                      <span className="text-lg font-semibold text-white truncate drop-shadow-md">{track.title}</span>
                      <span className="text-white/60 text-sm truncate">{track.artist}</span>
                    </div>
                    <span className="text-white/40 text-sm hidden md:block">{track.duration}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* === MAIN CONTENT (Hidden when searching) === */}
      {!isSearching && !showLibrary && (
        <main className="relative z-10 p-8 pt-24 h-screen overflow-y-auto no-scrollbar pb-40">
          
          {/* Recently Played */}
          {recentTracks.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-bold mb-6 text-white/90">Jump back in</h2>
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-8 px-8 snap-x">
                {recentTracks.map((track, i) => (
                  <div key={i} onClick={() => playTrack(track, recentTracks)} className="min-w-[140px] md:min-w-[180px] group cursor-pointer snap-start">
                    <div className="w-full aspect-square rounded-2xl overflow-hidden mb-3 relative shadow-lg">
                      <img src={getHighResThumbnail(track)} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play fill="white" size={32} />
                      </div>
                    </div>
                    <h3 className="font-semibold text-white truncate">{track.title}</h3>
                    <p className="text-white/50 text-xs truncate">{getArtistsText(track)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Popular / Trending */}
          {homeFeed.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-bold mb-6 text-white/90">Trending Now</h2>
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-8 px-8 snap-x">
                {homeFeed.map((track, i) => (
                  <div key={i} onClick={() => playTrack(track, homeFeed)} className="min-w-[140px] md:min-w-[180px] group cursor-pointer snap-start">
                    <div className="w-full aspect-square rounded-2xl overflow-hidden mb-3 relative shadow-lg">
                      <img src={getHighResThumbnail(track)} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play fill="white" size={32} />
                      </div>
                    </div>
                    <h3 className="font-semibold text-white truncate">{track.title}</h3>
                    <p className="text-white/50 text-xs truncate">{getArtistsText(track)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* AI Radio */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-white/90">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_12px_rgba(6,182,212,0.8)]" />
              {radioMix.seed_track === "Nothing yet" ? "AI Radio" : `AI Radio inspired by ${radioMix.seed_track}`}
            </h2>
            
            {loadingRadio && <div className="text-white/50 text-sm flex gap-2 items-center mb-6"><Loader2 className="animate-spin w-4 h-4"/> Curating personalized mixes...</div>}
            
            {!loadingRadio && radioMix.recommendations.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {radioMix.recommendations.map((track, i) => (
                  <div 
                    key={i} 
                    onClick={() => playTrack(track, radioMix.recommendations)}
                    className="aspect-[4/3] rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 hover:border-purple-500/50 hover:-translate-y-1 transition-all duration-300 cursor-pointer p-6 flex flex-col justify-end relative overflow-hidden group shadow-xl"
                  >
                    <img src={getHighResThumbnail(track)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-500 blur-[2px] group-hover:blur-sm" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                    
                    <h3 className="font-bold text-xl md:text-2xl relative z-10 tracking-tight text-white drop-shadow-lg truncate">{track.title}</h3>
                    <p className="text-white/80 text-sm relative z-10 truncate font-medium">{getArtistsText(track)}</p>
                    
                    <span className="absolute top-4 right-4 bg-purple-500/90 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg z-10 backdrop-blur-md">
                      {track.lastfm_match === "Auto-Mix" ? "Mix" : `${track.lastfm_match} Match`}
                    </span>
                  </div>
                ))}
              </div>
            )}
            
            {!loadingRadio && radioMix.recommendations.length === 0 && (
               <div className="w-full h-40 rounded-3xl border border-dashed border-white/20 flex flex-col items-center justify-center text-white/40 gap-2">
                 <p>No seed track found.</p>
                 <p className="text-sm">Play any song to auto-generate a smart queue!</p>
               </div>
            )}
          </section>
        </main>
      )}

      {/* Floating Audio Console */}
      {currentTrack && <FloatingConsole track={currentTrack} onTrackEnded={handleNextTrack} />}
    </div>
  );
}

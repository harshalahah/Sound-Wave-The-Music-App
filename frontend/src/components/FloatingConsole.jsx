import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, SkipBack, Maximize2, Minimize2, Loader2, Volume2, VolumeX, Heart } from 'lucide-react';

export default function FloatingConsole({ track, onTrackEnded, onTrackPrev }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [streamUrl, setStreamUrl] = useState(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('player_volume');
    return saved ? parseFloat(saved) : 0.8;
  });
  const [isMuted, setIsMuted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isLiking, setIsLiking] = useState(false);

  const audioRef = useRef(null);

  // Global playback toggle receiver
  useEffect(() => {
    const handleToggle = () => {
      setIsPlaying(prev => !prev);
    };
    window.addEventListener('toggle-playback', handleToggle);
    return () => window.removeEventListener('toggle-playback', handleToggle);
  }, []);

  const handlePrev = () => {
    if (audioRef.current) {
      if (audioRef.current.currentTime > 3) {
        audioRef.current.currentTime = 0;
        setCurrentTime(0);
      } else if (onTrackPrev) {
        onTrackPrev();
      }
    }
  };

  const toggleLike = async (e) => {
    e.stopPropagation();
    setIsLiking(true);
    try {
      const res = await fetch('/api/library/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: track.videoId })
      });
      const data = await res.json();
      setIsLiked(data.status === "liked");
    } catch (err) {
      console.error(err);
    } finally {
      setIsLiking(false);
    }
  };

  const handleSeek = (e) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) audioRef.current.currentTime = time;
  };

  const handleVolume = (e) => {
    const vol = Number(e.target.value);
    setVolume(vol);
    localStorage.setItem('player_volume', vol.toString());
    if (vol > 0) setIsMuted(false);
    if (audioRef.current) audioRef.current.volume = vol;
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (audioRef.current) audioRef.current.volume = newMuted ? 0 : volume;
  };

  // Sync initial volume on new audio stream load
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [streamUrl, isMuted, volume]);

  // When a new track hits the player, reach out to backend for the stream URL
  useEffect(() => {
    if (!track?.videoId) return;

    const fetchStreamUrl = async () => {
      setIsLoadingAudio(true);
      try {
        const res = await fetch(`/api/music/stream/${track.videoId}`);
        const data = await res.json();
        setStreamUrl(data.stream_url);
        // Auto-play when we fetch a new stream
        setIsPlaying(true);

        // Stealthily log this song to our backend SQLite database for Last.fm sync
        fetch('/api/history/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoId: track.videoId,
            title: track.title,
            artists: track.artists || [],
            thumbnails: track.thumbnails || [],
            duration: track.duration || "0:00"
          })
        }).catch(err => console.error("History log failed:", err));

      } catch (err) {
        console.error("Failed to fetch audio stream:", err);
      } finally {
        setIsLoadingAudio(false);
      }
    };

    fetchStreamUrl();
  }, [track?.videoId]);

  // Handle actually playing/pausing the HTML audio tag
  useEffect(() => {
    if (audioRef.current && streamUrl) {
      if (isPlaying) {
        audioRef.current.play().catch(e => console.error("Playback failed (usually browser autoplay restrictions):", e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, streamUrl]);

  // Completely hide until a track is selected
  if (!track) return null;

  const getHighResThumbnail = (t) => {
    if (t.thumbnails && t.thumbnails.length > 0) return t.thumbnails[t.thumbnails.length - 1].url;
    if (t.thumbnail_url) return t.thumbnail_url;
    return '';
  };
  const getArtistsText = (t) => {
    if (t.artists && Array.isArray(t.artists)) return t.artists.map(a => a.name).join(', ');
    if (t.artist) return t.artist;
    return 'Unknown Artist';
  };

  const thumbUrl = getHighResThumbnail(track);
  const artistNames = getArtistsText(track);

  return (
    <>
      <audio 
        ref={audioRef} 
        src={streamUrl} 
        onEnded={() => {
           setIsPlaying(false);
           if (onTrackEnded) onTrackEnded();
        }} 
        onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
        preload="auto" 
      />
      
      <motion.div 
        layout
        className="fixed bottom-6 left-1/2 z-50 overflow-hidden glass-card border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
        animate={{
          width: isExpanded ? 'min(90vw, 420px)' : '380px',
          height: isExpanded ? 'min(80vh, 680px)' : '84px',
          borderRadius: isExpanded ? '40px' : '9999px',
          x: '-50%'
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="relative w-full h-full flex flex-col p-4">
          
          {/* === COMPACT STATE === */}
          {!isExpanded && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1, transition: { delay: 0.1 } }} 
              className="flex items-center justify-between w-full h-full px-2 relative"
            >
              <div className="flex items-center gap-3.5 cursor-pointer truncate flex-1" onClick={() => setIsExpanded(true)}>
                <div className="relative w-12 h-12 flex-shrink-0 select-none">
                  <img 
                    src={thumbUrl} 
                    alt="" 
                    className={`w-full h-full rounded-full object-cover shadow-md ${isPlaying ? 'animate-[spin_8s_linear_infinite]' : ''}`} 
                  />
                  {/* Vinyl center dot */}
                  <div className="absolute inset-[38%] rounded-full bg-[#030303] border border-white/10 shadow-inner flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                  </div>
                </div>
                <div className="flex flex-col truncate pr-3 select-none">
                  <span className="text-white font-bold text-sm truncate tracking-tight font-['Outfit']">{track.title}</span>
                  <span className="text-white/45 text-xs text-left truncate font-semibold mt-0.5">{artistNames}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2.5 text-white/80">
                <button 
                  onClick={toggleLike} 
                  disabled={isLiking}
                  className="p-1.5 rounded-full text-white/40 hover:text-red-500 hover:bg-white/5 border border-transparent hover:border-white/5 transition-colors cursor-pointer"
                >
                  <Heart size={18} fill={isLiked ? "#ef4444" : "none"} className={isLiked ? "text-red-500" : ""} />
                </button>
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  disabled={isLoadingAudio}
                  className="w-10 h-10 flex flex-shrink-0 items-center justify-center rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isLoadingAudio ? <Loader2 size={18} className="animate-spin text-purple-600" /> : (isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />)}
                </button>
                <button
                  onClick={() => setIsExpanded(true)}
                  className="p-2 text-white/40 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/5 rounded-full transition-colors cursor-pointer"
                >
                  <Maximize2 size={16} className="flex-shrink-0" />
                </button>
              </div>

              {/* Pill Progress Strip */}
              <div 
                className="absolute bottom-[-16px] left-[-16px] right-[-16px] h-[3px] bg-gradient-to-r from-violet-500 to-cyan-400 rounded-full opacity-80" 
                style={{ width: `calc(${(currentTime / (duration || 1)) * 100}% + 32px)` }} 
              />
            </motion.div>
          )}

          {/* === EXPANDED STATE (IMMERSIVE FULL SCREEN PLAYER) === */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1, transition: { delay: 0.1 } }} 
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
                className="flex flex-col h-full items-center justify-between relative w-full px-2 py-4"
              >
                {/* Top header options */}
                <div className="flex items-center justify-between w-full select-none">
                  <span className="text-[11px] font-extrabold tracking-widest text-white/40 bg-white/5 border border-white/5 px-3.5 py-1.5 rounded-full uppercase">
                    Playing Deck
                  </span>
                  <button 
                    onClick={() => setIsExpanded(false)}
                    className="p-2.5 rounded-full bg-white/5 border border-white/5 text-white/55 hover:text-white hover:bg-white/10 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-md"
                  >
                    <Minimize2 size={18} />
                  </button>
                </div>
                
                {/* Massive Vinyl Art with Ambient Reflection Aura */}
                <div className="relative my-6 select-none flex-shrink-0">
                  <div className="absolute inset-[-12px] bg-gradient-to-tr from-purple-500/25 to-cyan-500/25 blur-2xl rounded-full opacity-80 animate-[pulse_4s_ease-in-out_infinite]" />
                  
                  <div className="relative w-56 h-56 rounded-full overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.65)] border-4 border-white/5 flex-shrink-0">
                    <img 
                      src={thumbUrl} 
                      alt="" 
                      className={`w-full h-full object-cover ${isPlaying ? 'animate-[spin_12s_linear_infinite]' : ''}`} 
                    />
                    {/* Concentric vinyl groove reflections */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.3)_60%,rgba(0,0,0,0.85)_100%)] mix-blend-overlay pointer-events-none" />
                    <div className="absolute inset-0 border-[6px] border-black/10 rounded-full pointer-events-none" />
                    
                    {/* Vinyl Center Core */}
                    <div className="absolute inset-[36%] rounded-full bg-[#030303] border-4 border-white/5 shadow-2xl flex items-center justify-center">
                      <div className="w-3.5 h-3.5 rounded-full bg-black/60 border border-white/10" />
                    </div>
                  </div>
                </div>
                
                {/* Bottom Deck Console */}
                <div className="w-full mt-auto px-2">
                  
                  {/* Song Title and Heart Row */}
                  <div className="flex items-center justify-between gap-4 mb-6">
                    <div className="flex flex-col text-left truncate flex-1">
                      <h2 className="text-2xl font-extrabold text-white tracking-tight truncate font-['Outfit'] select-none">{track.title}</h2>
                      <p className="text-sm font-semibold text-white/45 truncate mt-0.5 leading-none">{artistNames}</p>
                    </div>
                    <button 
                      onClick={toggleLike} 
                      disabled={isLiking} 
                      className="text-white/40 hover:text-red-500 transition-all duration-300 hover:scale-105 active:scale-95 flex-shrink-0 cursor-pointer p-2.5 rounded-full bg-white/5 border border-white/5 hover:border-white/10 shadow-md"
                    >
                      <Heart size={18} fill={isLiked ? "#ef4444" : "none"} className={isLiked ? "text-red-500 scale-110" : "text-white/60"} />
                    </button>
                  </div>
                  
                  {/* Timeline Scrubbing Slider */}
                  <div className="flex flex-col gap-2 w-full mb-6">
                    <input 
                      type="range" 
                      min="0" 
                      max={duration || 100} 
                      value={currentTime} 
                      onChange={handleSeek}
                      className="custom-slider w-full"
                    />
                    <div className="flex justify-between text-[10px] font-bold tracking-wider text-white/35 font-mono select-none">
                      <span>{Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, '0')}</span>
                      <span>{Math.floor(duration / 60)}:{(Math.floor(duration % 60)).toString().padStart(2, '0')}</span>
                    </div>
                  </div>

                  {/* Playback Buttons */}
                  <div className="flex items-center justify-center gap-7 text-white/80 w-full mb-6 select-none">
                    <button 
                      onClick={handlePrev}
                      className="p-2 hover:text-white transition-colors cursor-pointer hover:scale-105 active:scale-95"
                    >
                      <SkipBack size={24} />
                    </button>
                    <button 
                      onClick={() => setIsPlaying(!isPlaying)}
                      disabled={isLoadingAudio}
                      className="w-16 h-16 flex items-center justify-center rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-all shadow-[0_8px_25px_rgba(255,255,255,0.2)] border border-white cursor-pointer disabled:opacity-50"
                    >
                      {isLoadingAudio ? <Loader2 size={24} className="animate-spin text-purple-600" /> : (isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />)}
                    </button>
                    <button 
                      onClick={() => { setIsPlaying(false); if (onTrackEnded) onTrackEnded(); }} 
                      className="p-2 hover:text-white transition-colors cursor-pointer hover:scale-105 active:scale-95"
                    >
                      <SkipForward size={24} />
                    </button>
                  </div>
                  
                  {/* Volume Slider Bar */}
                  <div className="flex items-center justify-center gap-3 w-full max-w-[170px] mx-auto text-white/35 hover:text-white/60 transition-colors">
                     <button onClick={toggleMute} className="flex-shrink-0 cursor-pointer p-1.5 rounded-full hover:bg-white/5 border border-transparent hover:border-white/5 transition-all active:scale-95">
                       {isMuted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
                     </button>
                     <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01"
                      value={isMuted ? 0 : volume} 
                      onChange={handleVolume}
                      className="custom-slider flex-1"
                    />
                  </div>
                  
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}

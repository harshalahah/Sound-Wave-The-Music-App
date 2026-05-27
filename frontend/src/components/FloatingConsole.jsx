import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, SkipBack, Maximize2, Minimize2, Loader2, Volume2, VolumeX, Heart } from 'lucide-react';

export default function FloatingConsole({ track, onTrackEnded }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [streamUrl, setStreamUrl] = useState(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isLiking, setIsLiking] = useState(false);

  const audioRef = useRef(null);

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
    if (vol > 0) setIsMuted(false);
    if (audioRef.current) audioRef.current.volume = vol;
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (audioRef.current) audioRef.current.volume = newMuted ? 0 : volume;
  };

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
        className="fixed bottom-6 left-1/2 z-50 overflow-hidden backdrop-blur-2xl bg-white/5 border border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.5)]"
        animate={{
          width: isExpanded ? '90vw' : '400px',
          height: isExpanded ? '90vh' : '80px',
          borderRadius: isExpanded ? '32px' : '9999px',
          x: '-50%'
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="relative w-full h-full flex flex-col p-4">
          
          {/* === COMPACT STATE === */}
          {!isExpanded && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.1 } }} className="flex items-center justify-between w-full h-full px-2">
              <div className="flex items-center gap-4 cursor-pointer truncate flex-1" onClick={() => setIsExpanded(true)}>
                <img 
                  src={thumbUrl} 
                  alt="" 
                  className={`w-12 h-12 rounded-full object-cover shadow-lg flex-shrink-0 ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}`} 
                />
                <div className="flex flex-col truncate pr-4">
                  <span className="text-white font-semibold text-sm truncate">{track.title}</span>
                  <span className="text-gray-400 text-xs text-left truncate">{artistNames}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-3 text-white/80">
                <button 
                  onClick={toggleLike} 
                  disabled={isLiking}
                  className="mr-2 text-white/50 hover:text-red-500 transition-colors"
                >
                  <Heart size={20} fill={isLiked ? "currentColor" : "none"} className={isLiked ? "text-red-500" : ""} />
                </button>
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  disabled={isLoadingAudio}
                  className="w-10 h-10 flex flex-shrink-0 items-center justify-center rounded-full bg-white text-black hover:scale-105 transition-transform disabled:opacity-50"
                >
                  {isLoadingAudio ? <Loader2 size={18} className="animate-spin" /> : (isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />)}
                </button>
                <Maximize2 size={18} className="ml-2 hover:text-white cursor-pointer opacity-50 hover:opacity-100 flex-shrink-0" onClick={() => setIsExpanded(true)} />
              </div>
            </motion.div>
          )}

          {/* === EXPANDED STATE (IMMERSIVE FULL SCREEN PLAYER) === */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1, transition: { delay: 0.1 } }} 
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
                className="flex flex-col h-full items-center justify-center relative w-full pt-6"
              >
                <button 
                  onClick={() => setIsExpanded(false)}
                  className="absolute top-4 right-4 p-3 rounded-full bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-all backdrop-blur-md z-10 shadow-xl"
                >
                  <Minimize2 size={24} />
                </button>
                
                {/* Massive Artwork */}
                <div className="relative mb-8">
                  <div className="absolute inset-[-10px] bg-white/10 blur-xl rounded-3xl animate-pulse" />
                  <img 
                    src={thumbUrl} 
                    alt="" 
                    className="relative w-64 h-64 md:w-96 md:h-96 rounded-3xl object-cover shadow-[0_0_80px_rgba(0,0,0,0.5)] border border-white/5" 
                  />
                </div>
                
                <div className="text-center w-full max-w-md px-6">
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-2 truncate drop-shadow-md flex items-center justify-center gap-4">
                    {track.title}
                    <button onClick={toggleLike} disabled={isLiking} className="text-white/50 hover:text-red-500 transition-transform hover:scale-110 active:scale-95 flex-shrink-0">
                       <Heart size={28} fill={isLiked ? "currentColor" : "none"} className={isLiked ? "text-red-500" : ""} />
                    </button>
                  </h2>
                  <p className="text-lg text-white/60 mb-8 truncate drop-shadow-sm">{artistNames}</p>
                  
                  {/* Seek Bar / Scrubbing */}
                  <div className="flex items-center gap-3 w-full mb-8 px-4">
                    <span className="text-xs text-white/50 w-10 text-right tracking-widest">{Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, '0')}</span>
                    <input 
                      type="range" 
                      min="0" 
                      max={duration || 100} 
                      value={currentTime} 
                      onChange={handleSeek}
                      className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white hover:accent-purple-500 transition-all border-none"
                    />
                    <span className="text-xs text-white/50 w-10 tracking-widest">{Math.floor(duration / 60)}:{(Math.floor(duration % 60)).toString().padStart(2, '0')}</span>
                  </div>

                  <div className="flex items-center justify-center gap-8 text-white w-full">
                    <SkipBack size={32} className="hover:text-white/80 cursor-pointer transition-colors" />
                    <button 
                      onClick={() => setIsPlaying(!isPlaying)}
                      disabled={isLoadingAudio}
                      className="w-20 h-20 flex items-center justify-center rounded-full bg-white text-black hover:scale-105 transition-transform outline-none shadow-[0_0_40px_rgba(255,255,255,0.3)] disabled:animate-pulse disabled:scale-95"
                    >
                      {isLoadingAudio ? <Loader2 size={32} className="animate-spin" /> : (isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-2" />)}
                    </button>
                    <SkipForward size={32} onClick={() => { setIsPlaying(false); if (onTrackEnded) onTrackEnded(); }} className="hover:text-white/80 cursor-pointer transition-colors" />
                  </div>
                  
                  {/* Volume Control */}
                  <div className="flex items-center justify-center gap-3 mt-8 w-full max-w-[200px] mx-auto text-white/60 hover:text-white transition-colors">
                     <button onClick={toggleMute} className="flex-shrink-0">
                       {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                     </button>
                     <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01"
                      value={isMuted ? 0 : volume} 
                      onChange={handleVolume}
                      className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white outline-none"
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

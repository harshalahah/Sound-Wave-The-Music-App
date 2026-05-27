from fastapi import APIRouter, HTTPException
from ytmusicapi import YTMusic
import yt_dlp
import logging

router = APIRouter()
ytmusic = YTMusic()
logger = logging.getLogger(__name__)

@router.get("/search")
def search_songs(query: str, limit: int = 20):
    try:
        # Search YT Music for songs
        results = ytmusic.search(query, filter="songs", limit=limit)
        
        # Format the response to be cleaner for our React frontend
        formatted_results = []
        for track in results:
            formatted_results.append({
                "videoId": track.get("videoId"),
                "title": track.get("title"),
                "artists": [{"name": artist.get("name"), "id": artist.get("id")} for artist in track.get("artists", [])],
                "album": track.get("album", {}).get("name") if track.get("album") else None,
                "duration": track.get("duration"),
                "thumbnails": track.get("thumbnails", [])
            })
        
        return {"results": formatted_results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/home")
def get_home_feed():
    try:
        charts = ytmusic.get_charts(country='US')
        trending = charts.get("trending", {})
        items = trending.get("items", [])
        results = []
        for track in items:
            # ytmusic API sometimes formats charts slightly differently
            results.append({
                "videoId": track.get("videoId"),
                "title": track.get("title"),
                "artists": track.get("artists", [{"name": "Unknown"}]),
                "thumbnails": track.get("thumbnails", [{"url": ""}]),
                "duration": track.get("duration", "0:00")
            })
        return {"trending": results}
    except Exception as e:
        return {"trending": [], "error": str(e)}

@router.get("/stream/{video_id}")
def get_stream_url(video_id: str):
    """
    Given a YouTube Music video ID, fetches the real, playable direct audio URL.
    """
    try:
        url = f"https://music.youtube.com/watch?v={video_id}"
        # We use yt-dlp to extract the highest quality audio URL without downloading the file
        with yt_dlp.YoutubeDL({'format': 'bestaudio/best', 'quiet': True}) as ydl:
            info = ydl.extract_info(url, download=False)
            audio_url = info.get('url')
            
            if not audio_url:
                raise HTTPException(status_code=404, detail="Audio stream not found for this track")
                
            return {"stream_url": audio_url, "title": info.get('title')}
            
    except Exception as e:
        logger.error(f"Stream extraction error for {video_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to extract audio stream")

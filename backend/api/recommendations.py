import os
import httpx
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from sqlalchemy.orm import Session
from database import get_db
import models
from ytmusicapi import YTMusic
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()
ytmusic = YTMusic()

LASTFM_API_KEY = os.getenv("LASTFM_API_KEY", "YOUR_LASTFM_KEY_HERE")

@router.get("/")
async def get_radio_recommendations(db: Session = Depends(get_db)):
    """
    Checks history in PostgreSQL, pings Last.fm for similar tracks, and retrieves
    playable youtube stream endpoints for each similar track.
    """
    # 1. Grab the latest track played by the user
    latest_history = db.query(models.ListenHistory).order_by(models.ListenHistory.played_at.desc()).first()
    
    if not latest_history:
        return {"seed_track": "Nothing yet", "recommendations": []}

    target_track = latest_history.track
    
    # 2. Call Last.fm API
    url = f"http://ws.audioscrobbler.com/2.0/?method=track.getsimilar&artist={target_track.artist}&track={target_track.title}&api_key={LASTFM_API_KEY}&format=json&limit=5"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        
    data = response.json()
    
    # 3. Fallback logic if API key isn't provided yet
    if "error" in data:
        print("Last.fm Error or missing key. Falling back to native Youtube Radio Engine...")
        watch_playlist = ytmusic.get_watch_playlist(videoId=target_track.id, limit=6)
        fallback_recs = []
        # skip index 0 since that's Usually the seed track itself
        for track in watch_playlist.get("tracks", [])[1:6]:
            fallback_recs.append({
                "videoId": track.get("videoId"),
                "title": track.get("title"),
                "artists": track.get("artists", [{"name": "Unknown"}]),
                "thumbnails": track.get("thumbnails", track.get("thumbnail", [{"url": ""}])),
                "duration": track.get("length", "0:00"),
                "lastfm_match": "Auto-Mix"
            })
        if fallback_recs:
             return {
                "seed_track": f"{target_track.title}",
                "recommendations": fallback_recs
            }
        raise HTTPException(status_code=401, detail=f"Last.fm Error: {data.get('message', 'Invalid API Key')}")

    # 4. Standard Last.fm Path: Find streamable youtube IDs for the Last.fm recommendations
    similar_tracks = data.get("similartracks", {}).get("track", [])
    
    recommended_vids = []
    for st in similar_tracks[:5]:
        query = f"{st['name']} {st['artist']['name']}"
        yt_search = ytmusic.search(query, filter="songs", limit=1)
        if yt_search:
            top_hit = yt_search[0]
            recommended_vids.append({
                "videoId": top_hit.get("videoId"),
                "title": top_hit.get("title"),
                "artists": top_hit.get("artists", [{"name": "Unknown"}]),
                "thumbnails": top_hit.get("thumbnails", top_hit.get("thumbnail", [{"url": ""}])),
                "duration": top_hit.get("duration", "0:00"),
                "lastfm_match": f"{round(float(st.get('match', 0)) * 100)}%"
            })

    return {
        "seed_track": f"{target_track.title}",
        "recommendations": recommended_vids
    }

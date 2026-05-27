from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
from pydantic import BaseModel

router = APIRouter()

class TrackRequest(BaseModel):
    videoId: str
    title: str
    artists: list = []
    thumbnails: list = []
    duration: str = "0:00"

@router.post("/")
def log_listen_history(track_data: TrackRequest, db: Session = Depends(get_db)):
    """
    Logs a song into the local SQLite DB to track what the user listens to.
    """
    # 1. Create a default "local" user if none exists (since it's a personal app)
    user = db.query(models.User).filter(models.User.id == 1).first()
    if not user:
        user = models.User(id=1, username="default_local_user")
        db.add(user)
        db.commit()

    # 2. Add or skip Track metadata
    track = db.query(models.Track).filter(models.Track.id == track_data.videoId).first()
    if not track:
        artist_name = track_data.artists[0]["name"] if track_data.artists else "Unknown"
        thumb_url = track_data.thumbnails[-1]["url"] if track_data.thumbnails else ""
        track = models.Track(
            id=track_data.videoId,
            title=track_data.title,
            artist=artist_name,
            thumbnail_url=thumb_url,
            duration=track_data.duration,
        )
        db.add(track)
        db.commit()

    # 3. Record the historical listen event
    history_entry = models.ListenHistory(user_id=1, track_id=track_data.videoId)
    db.add(history_entry)
    db.commit()
    
    return {"status": "success", "message": "History logged"}

@router.get("/recent")
def get_recent_history(db: Session = Depends(get_db)):
    """Fetch recent unique listening history for the home screen layout."""
    recent = db.query(models.ListenHistory).filter(models.ListenHistory.user_id == 1).order_by(models.ListenHistory.played_at.desc()).limit(20).all()
    results = []
    seen = set()
    for h in recent:
        if h.track and h.track.id not in seen:
            seen.add(h.track.id)
            results.append({
                "videoId": h.track.id,
                "title": h.track.title,
                "artists": [{"name": h.track.artist}],
                "thumbnails": [{"url": h.track.thumbnail_url}],
                "duration": h.track.duration
            })
    return {"results": results[:10]}

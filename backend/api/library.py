from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
from pydantic import BaseModel

router = APIRouter()

class LikeRequest(BaseModel):
    videoId: str

@router.post("/like")
def toggle_like(req: LikeRequest, db: Session = Depends(get_db)):
    """Toggles the like status of a song for the local user."""
    # Ensure default user logic is safe
    user = db.query(models.User).filter(models.User.id == 1).first()
    if not user:
        user = models.User(id=1, username="default_local_user")
        db.add(user)
        db.commit()

    existing_like = db.query(models.UserLike).filter(models.UserLike.user_id == 1, models.UserLike.track_id == req.videoId).first()
    
    if existing_like:
        db.delete(existing_like)
        db.commit()
        return {"status": "unliked"}
    else:
        # Before linking, the track must exist in Tracks table, which usually happens during /history POST.
        # If it doesn't, we should fetch/create it, but realistically they only like songs they play.
        new_like = models.UserLike(user_id=1, track_id=req.videoId)
        db.add(new_like)
        db.commit()
        return {"status": "liked"}

@router.get("/liked")
def get_liked_songs(db: Session = Depends(get_db)):
    likes = db.query(models.UserLike).filter(models.UserLike.user_id == 1).order_by(models.UserLike.liked_at.desc()).all()
    
    tracks = []
    for like in likes:
        if like.track:
            tracks.append({
                "videoId": like.track.id,
                "title": like.track.title,
                "artist": like.track.artist,
                "thumbnail_url": like.track.thumbnail_url,
                "duration": like.track.duration
            })
            
    return {"results": tracks}

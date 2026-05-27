from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    history = relationship("ListenHistory", back_populates="user")

class Track(Base):
    __tablename__ = "tracks"
    id = Column(String, primary_key=True, index=True) # YouTube videoId
    title = Column(String, index=True)
    artist = Column(String)
    thumbnail_url = Column(String)
    duration = Column(String)
    
class ListenHistory(Base):
    __tablename__ = "listen_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    track_id = Column(String, ForeignKey("tracks.id"))
    played_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="history")
    track = relationship("Track")

class Playlist(Base):
    __tablename__ = "playlists"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    
class PlaylistTrack(Base):
    __tablename__ = "playlist_tracks"
    id = Column(Integer, primary_key=True, index=True)
    playlist_id = Column(Integer, ForeignKey("playlists.id"))
    track_id = Column(String, ForeignKey("tracks.id"))

class UserLike(Base):
    __tablename__ = "user_likes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    track_id = Column(String, ForeignKey("tracks.id"))
    liked_at = Column(DateTime(timezone=True), server_default=func.now())
    
    track = relationship("Track")

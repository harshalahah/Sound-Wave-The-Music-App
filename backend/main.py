from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import music, history, recommendations, library
from database import engine, Base

# On boot, create all SQL tables (if they don't exist yet)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Personal Music App API", version="0.1.0")

# Allow CORS for local frontend development (Vite usually uses port 5173, Next.js 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(music.router, prefix="/api/music", tags=["Music"])
app.include_router(history.router, prefix="/api/history", tags=["History"])
app.include_router(recommendations.router, prefix="/api/recommendations", tags=["Recommendations"])
app.include_router(library.router, prefix="/api/library", tags=["Library"])

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Backend is running flawlessly"}

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Hackathon API")

# カンマ区切りで複数指定可。例: CORS_ORIGINS=http://localhost:5173,https://example.com
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,"
                        "https://hackathon-gamma-self.vercel.app").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/hello")
def hello():
    return {"message": "hello"}

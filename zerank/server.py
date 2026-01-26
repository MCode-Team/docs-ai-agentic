"""
zerank-2 Reranker API Server
Compatible with Hugging Face TEI /rerank endpoint format
"""
import os
import logging
from typing import List, Optional
from contextlib import asynccontextmanager

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import CrossEncoder

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Model configuration
MODEL_ID = os.getenv("MODEL_ID", "zeroentropy/zerank-2")
HF_TOKEN = os.getenv("HUGGING_FACE_HUB_TOKEN", None)

# Global model instance
model: Optional[CrossEncoder] = None


class RerankRequest(BaseModel):
    query: str
    texts: List[str]
    truncate: bool = True


class RerankResult(BaseModel):
    index: int
    score: float
    text: Optional[str] = None


class RerankResponse(BaseModel):
    results: List[RerankResult]


class HealthResponse(BaseModel):
    status: str
    model: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup"""
    global model
    logger.info(f"Loading model: {MODEL_ID}")
    
    try:
        # Load CrossEncoder model
        model = CrossEncoder(
            MODEL_ID,
            max_length=512,
            device="cpu",  # Use CPU for compatibility
            trust_remote_code=True,
            token=HF_TOKEN
        )
        logger.info(f"Model {MODEL_ID} loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        raise
    
    yield
    
    # Cleanup
    logger.info("Shutting down...")


app = FastAPI(
    title="zerank-2 Reranker API",
    description="TEI-compatible reranker API using zeroentropy/zerank-2",
    version="1.0.0",
    lifespan=lifespan
)


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    return HealthResponse(status="ok", model=MODEL_ID)


@app.post("/rerank", response_model=RerankResponse)
async def rerank(request: RerankRequest):
    """
    Rerank documents based on query relevance.
    Compatible with Hugging Face TEI /rerank endpoint.
    """
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    if not request.texts:
        return RerankResponse(results=[])
    
    try:
        # Create query-document pairs
        pairs = [[request.query, text] for text in request.texts]
        
        # Process each pair individually to avoid padding issues
        scores = []
        with torch.no_grad():
            for pair in pairs:
                score = model.predict([pair])
                if hasattr(score, 'tolist'):
                    score = score.tolist()
                scores.append(float(score[0]) if isinstance(score, list) else float(score))
        
        # Create results with index and score
        results = [
            RerankResult(
                index=i,
                score=score,
                text=request.texts[i]
            )
            for i, score in enumerate(scores)
        ]
        
        # Sort by score descending
        results.sort(key=lambda x: x.score, reverse=True)
        
        return RerankResponse(results=results)
    
    except Exception as e:
        logger.error(f"Rerank error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "zerank-2 Reranker",
        "model": MODEL_ID,
        "endpoints": {
            "rerank": "POST /rerank",
            "health": "GET /health"
        }
    }


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 80))
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )

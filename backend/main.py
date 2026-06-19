from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routes import graph, chat

app = FastAPI(
    title="Knowledge Graph LLM API",
    description="API for enterprise knowledge graph and LLM integration",
    version="1.0.0"
)

@app.on_event("startup")
async def startup_event():
    """
    Seed data on startup.
    - On Vercel: Customer support data is auto-loaded from backend/data/seed_customer_support.json
    - Locally: ACME corp data is seeded if database is empty
    """
    import os
    
    # On local development, seed Big Data demo when graph is empty
    if not os.environ.get('VERCEL'):
        from backend.services.graph_service import graph_service
        from backend.services.seed_big_data_demo import seed_big_data_demo
        if len(graph_service.get_all_entities()) == 0:
            seed_big_data_demo()
        else:
            print("Knowledge Graph already has data. Skipping seed.")
    else:
        print("🚀 Vercel environment detected - seed data will be auto-loaded")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Temporarily allow all for debugging
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request, call_next):
    print(f"DEBUG: Incoming request: {request.method} {request.url.path}")
    response = await call_next(request)
    print(f"DEBUG: Response status: {response.status_code}")
    return response

# Include routers with central prefix
app.include_router(graph.router, prefix="/api")
app.include_router(chat.router, prefix="/api/chat")

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    print(f"CRITICAL ERROR: {exc}")
    import traceback
    traceback.print_exc()
    return {"error": str(exc)}

@app.get("/")
async def root():
    return {
        "message": "Knowledge Graph LLM API",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class Citation(BaseModel):
    entityId: str
    entityName: str
    entityType: str
    snippet: Optional[str] = None

class UsedContext(BaseModel):
    entities: List[str]
    relationships: List[str]
    subgraph: Optional[Dict[str, List[str]]] = None
    raw_context_string: Optional[str] = None

class Message(BaseModel):
    id: str
    role: str  # 'user' | 'assistant' | 'system'
    content: str
    timestamp: str
    citations: Optional[List[Citation]] = None
    usedContext: Optional[UsedContext] = None
    reasoning: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    groundingMode: str  # 'generic' | 'kg_only' | 'kg_full'
    conversationHistory: Optional[List[Message]] = None
    focusEntityId: Optional[str] = None

class ChatResponse(BaseModel):
    message: Message
    usedContext: UsedContext
    tokensUsed: Optional[int] = None

class StreamChunk(BaseModel):
    delta: str
    done: bool

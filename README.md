# Enterprise Knowledge-Graph–Grounded LLM Web App

A sophisticated web application that enables enterprises to model their organizational knowledge as a graph and use it to ground LLM responses with trusted, structured context.

## 🌟 Features

- **Interactive Knowledge Graph**: Visualize and manage your enterprise knowledge with an interactive force-directed graph
- **Entity Management**: Create, edit, and delete entities (teams, systems, policies, processes, etc.)
- **Relationship Mapping**: Define typed relationships between entities
- **Grounded LLM Chat**: Ask questions and get answers grounded in your knowledge graph
- **Multiple Grounding Modes**:
  - **Strict**: Only use knowledge graph data
  - **Hybrid**: Prioritize graph data, supplement with general knowledge
  - **General**: Unrestricted responses
- **Streaming Responses**: Real-time streaming chat responses
- **Context Explainability**: See which graph elements were used to answer your questions

## 🏗️ Architecture

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **D3.js** for interactive graph visualization
- **Zustand** for state management
- **React Router** for navigation

### Backend
- **FastAPI** for high-performance API
- **OpenAI API** for LLM integration (pluggable for other providers)
- **In-memory graph storage** (easily replaceable with Neo4j or other graph databases)
- **Server-Sent Events** for streaming responses

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- OpenAI API key (optional, for chat functionality)

### Installation

1. **Clone the repository** (or navigate to the project directory)

2. **Install frontend dependencies**:
```bash
npm install
```

3. **Install backend dependencies**:
```bash
cd backend
pip install -r requirements.txt
cd ..
```

4. **Configure environment variables**:
```bash
# Copy the example env file
cp .env.example .env

# Edit .env and add your OpenAI API key
# OPENAI_API_KEY=your_key_here
```

### Running the Application

#### Option 1: Run Both Servers Separately

**Terminal 1 - Frontend**:
```bash
npm run dev
```
The frontend will be available at `http://localhost:5173`

**Terminal 2 - Backend**:
```bash
cd backend
python -m uvicorn main:app --reload --port 8000
```
The API will be available at `http://localhost:8000`

#### Option 2: Quick Start Script (Windows)

Create a file `start.ps1`:
```powershell
# Start backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; python -m uvicorn main:app --reload --port 8000"

# Wait a moment for backend to start
Start-Sleep -Seconds 2

# Start frontend
npm run dev
```

Then run:
```bash
.\start.ps1
```

## 📖 Usage

### 1. Build Your Knowledge Graph

1. Navigate to the **Graph** page (default view)
2. Click **"+ New Entity"** in the right panel
3. Fill in entity details:
   - Name (e.g., "Data Team")
   - Type (team, system, policy, etc.)
   - Description
4. Click **"Create"**
5. Repeat to add more entities

### 2. Create Relationships

1. Select an entity from the graph
2. In the entity panel, click **"+ Add"** under Relationships
3. Choose a target entity and relationship type
4. Click **"Create"**

### 3. Chat with Your Knowledge Graph

1. Navigate to the **Chat** page
2. Select a grounding mode (Strict, Hybrid, or General)
3. Ask questions about your knowledge graph:
   - "What systems does the Data Team own?"
   - "Show me all policies that govern our API"
   - "What are the dependencies of our Payment System?"

### 4. Explore Sample Data

The application loads sample data automatically if no backend is available, so you can explore the interface immediately.

## 🎨 Design Highlights

- **Professional Color Palette**: Blue-gray primary with vibrant teal accents
- **Modern Typography**: Inter font family for clean, readable text
- **Smooth Animations**: Micro-interactions and transitions for enhanced UX
- **Responsive Layout**: Works on desktop and tablet devices
- **Dark Mode Ready**: Theme tokens prepared for dark mode implementation

## 🔧 Configuration

### Grounding Modes

Edit `backend/services/context_service.py` to adjust:
- `max_entities`: Maximum entities to include in context (default: 20)
- `max_depth`: Graph traversal depth (default: 2)

### LLM Model

Edit `backend/services/llm_service.py`:
```python
self.model = "gpt-4o-mini"  # Change to "gpt-4" for better quality
```

## 📁 Project Structure

```
Knowledge Graph based LLM/
├── src/                          # Frontend source
│   ├── components/               # React components
│   │   ├── Layout/              # App layout
│   │   ├── Graph/               # Graph visualization & entity panel
│   │   └── Chat/                # Chat interface
│   ├── pages/                   # Page components
│   ├── store/                   # Zustand state management
│   ├── api/                     # API clients
│   ├── types/                   # TypeScript types
│   └── styles/                  # CSS and design system
├── backend/                     # Backend API
│   ├── models/                  # Pydantic models
│   ├── services/                # Business logic
│   │   ├── graph_service.py    # Graph storage & operations
│   │   ├── context_service.py  # Context assembly
│   │   └── llm_service.py      # LLM integration
│   ├── routes/                  # API endpoints
│   └── main.py                  # FastAPI app
└── README.md
```

## 🚧 Future Enhancements

- [ ] Neo4j integration for production graph storage
- [ ] User authentication and multi-workspace support
- [ ] Advanced graph analytics and insights
- [ ] Knowledge ingestion from documents
- [ ] Temporal graph support
- [ ] Export/import graph data
- [ ] Advanced search and filtering
- [ ] Graph validation rules
- [ ] Audit logging
- [ ] Performance optimizations for large graphs

## 📝 API Documentation

Once the backend is running, visit:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## 🤝 Contributing

This is an enterprise-grade MVP. Contributions for production features like authentication, database integration, and advanced analytics are welcome.

## 📄 License

MIT License - feel free to use this as a foundation for your enterprise knowledge management system.

## 🙏 Acknowledgments

Built with modern web technologies and best practices for enterprise applications.

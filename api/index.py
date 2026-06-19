import sys
import os

# Add the project root to sys.path so imports like 'backend.main' work
# 'api/index.py' is inside 'api/', so we go up one level
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app

# This is the Vercel Serverless Function entry point

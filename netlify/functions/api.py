import sys
import os

# Add the root directory to sys.path so we can import 'backend'
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from mangum import Mangum
from backend.server import app

# Wrap the FastAPI app with Mangum for serverless support
handler = Mangum(app)

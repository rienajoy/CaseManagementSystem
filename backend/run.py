from main import app
from config import Config
from flask_cors import CORS

CORS(
    app,
    resources={r"/*": {"origins": ["http://localhost:5173"]}},
    supports_credentials=True,
)

if __name__ == "__main__":
    app.run(debug=Config.DEBUG, host="0.0.0.0", port=5000)
import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
import logging
from flask_migrate import Migrate

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)
app = Flask(__name__)
migrate = Migrate(app, db)  # Ensure this line exists


# Configure app
app.secret_key = os.environ.get("SESSION_SECRET", "dev_key")
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "postgresql://postgres:post@localhost:5432/shoplead_db")
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}
app.config["UPLOAD_FOLDER"] = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # Limit upload size to 16MB

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize extensions
db.init_app(app)

# Create upload folder if it doesn't exist
UPLOAD_FOLDER = "C:/New folder/uploads"
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER


# Import routes after app initialization to avoid circular imports
from routes import *  # noqa: F401

with app.app_context():
    db.create_all()
    logger.info("Database tables created successfully.")

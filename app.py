import os
import logging
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from werkzeug.middleware.proxy_fix import ProxyFix

# Configure logging for debugging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)

# Create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-production")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Configure the database
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "sqlite:///contracts.db")
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}

# Initialize the app with the extension
db.init_app(app)

# Import routes after app creation to avoid circular imports
from routes.api_routes import api_bp
from routes.web_routes import web_bp
from routes.admin_routes import admin_bp

app.register_blueprint(api_bp, url_prefix='/api')
app.register_blueprint(admin_bp)
app.register_blueprint(web_bp)

with app.app_context():
    # Import models to ensure tables are created
    import models  # noqa: F401
    
    # Only create tables if they don't exist (avoid Docker conflicts)
    try:
        db.create_all()
        
        # Check if we need to restore data after table creation
        if os.environ.get('DOCKER_CONTAINER'):
            import psycopg2
            conn = psycopg2.connect(os.environ['DATABASE_URL'])
            cur = conn.cursor()
            
            # Check if contract table is empty
            cur.execute("SELECT COUNT(*) FROM contract")
            count = cur.fetchone()[0]
            
            if count == 0:
                logging.info("Empty tables detected in Docker, restoring database snapshot")
                try:
                    from restore_db_snapshot import restore_database_snapshot
                    restore_database_snapshot()
                    logging.info("Database snapshot restored successfully")
                except Exception as restore_error:
                    logging.error(f"Database restoration failed: {restore_error}")
            
            cur.close()
            conn.close()
            
    except Exception as e:
        # Handle case where tables already exist (common in Docker)
        if "already exists" in str(e) or "duplicate key" in str(e):
            logging.info("Database tables already exist, skipping creation")
        else:
            logging.error(f"Database initialization error: {e}")
            raise e

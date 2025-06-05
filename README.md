# Government Contract Intelligence Platform

A Flask-powered AI contract intelligence platform that intelligently indexes, processes, and analyzes government contracts from SAM.gov, transforming complex procurement data into actionable insights.

## Features

- **Contract Discovery**: Fetch and index government contracts from SAM.gov API
- **Document Processing**: Extract and process contract documents with AI-powered analysis
- **Vector Search**: Semantic search capabilities using ChromaDB
- **AI Analysis**: Contract insights and bidding recommendations using OpenRouter API
- **Web Interface**: Clean, responsive interface for searching and analyzing contracts

## Architecture

- **Backend**: Python Flask with SQLAlchemy ORM
- **Database**: PostgreSQL for relational data
- **Vector Database**: ChromaDB for semantic search
- **AI Integration**: OpenRouter API with Claude 3.5 Sonnet
- **Document Processing**: PDF/Word extraction with optional Norshin.com API integration

## Quick Start with Docker

### Prerequisites

- Docker and Docker Compose
- API keys for OpenRouter and SAM.gov

### Setup

1. **Clone and configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

2. **Build and run with Docker Compose**:
   ```bash
   docker-compose up --build
   ```

3. **Access the application**:
   - Web Interface: http://localhost:5000
   - API Documentation: http://localhost:5000/api/docs

### Environment Variables

Required variables in `.env`:

```bash
# API Keys (Required)
OPENROUTER_API_KEY=your_openrouter_api_key_here
SAM_GOV_API_KEY=your_sam_gov_api_key_here

# Database (Auto-configured in Docker)
DATABASE_URL=postgresql://contract_user:contract_password@postgres:5432/contract_db

# Application
SESSION_SECRET=your-secure-session-key-here
```

## Manual Installation

### Prerequisites

- Python 3.11+
- PostgreSQL 15+
- System dependencies: build-essential, libpq-dev

### Setup

1. **Install dependencies**:
   ```bash
   pip install uv
   uv pip install -r uv.lock
   ```

2. **Configure database**:
   ```bash
   createdb contract_db
   export DATABASE_URL="postgresql://user:password@localhost/contract_db"
   ```

3. **Initialize database**:
   ```bash
   python -c "from main import app; from models import db; app.app_context().push(); db.create_all()"
   ```

4. **Run application**:
   ```bash
   gunicorn --bind 0.0.0.0:5000 main:app
   ```

## API Endpoints

### Contract Management
- `POST /api/fetch-contracts` - Fetch contracts from SAM.gov
- `POST /api/index-contracts` - Index contracts in vector database
- `GET /api/contracts/{notice_id}` - Get contract details
- `POST /api/contracts/{notice_id}/analyze` - Analyze specific contract

### Search and Analysis
- `POST /api/search` - Search contracts and documents
- `POST /api/recommendations` - Get bidding recommendations
- `GET /api/status` - System status and statistics

### Document Processing
- `POST /api/process-documents` - Process contract documents
- `POST /api/process-documents-norshin` - Process via Norshin.com API

## Usage Examples

### Fetch Recent Contracts
```bash
curl -X POST http://localhost:5000/api/fetch-contracts \
  -H "Content-Type: application/json" \
  -d '{"limit": 50}'
```

### Search Contracts
```bash
curl -X POST http://localhost:5000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "software development", "limit": 10}'
```

### Analyze Contract
```bash
curl -X POST http://localhost:5000/api/contracts/NOTICE_ID/analyze
```

## Development

### Database Migrations

The application automatically creates database tables on startup. For schema changes:

1. Update models in `models.py`
2. Restart the application to apply changes

### Adding New Features

- **Routes**: Add to `routes/web_routes.py` or `routes/api_routes.py`
- **Services**: Add to `services/` directory
- **Models**: Add to `models.py`
- **Templates**: Add to `templates/` directory

### Testing

```bash
# Test document processing
python test_norshin_integration.py

# Test API endpoints
curl -X GET http://localhost:5000/api/status
```

## Production Deployment

### Docker Deployment

1. **Set production environment variables**:
   ```bash
   export FLASK_ENV=production
   export FLASK_DEBUG=0
   ```

2. **Use production database**:
   ```bash
   export DATABASE_URL="postgresql://user:pass@prod-db:5432/contract_db"
   ```

3. **Deploy with Docker Compose**:
   ```bash
   docker-compose -f docker-compose.yml up -d
   ```

### Scaling Considerations

- **Database**: Use managed PostgreSQL service
- **Vector Database**: ChromaDB supports clustering
- **Application**: Scale horizontally with load balancer
- **API Limits**: Implement rate limiting for SAM.gov API

## Security

- **API Keys**: Store securely in environment variables
- **Database**: Use strong passwords and SSL connections
- **Session Management**: Configure secure session keys
- **CORS**: Configure appropriately for production

## Monitoring

### Health Checks

- Application: `GET /`
- Database: Built-in PostgreSQL health checks
- Vector Database: ChromaDB telemetry

### Logging

Application logs include:
- API request/response details
- Contract processing status
- AI analysis performance metrics
- Error tracking and debugging info

## Support

For issues or questions:
1. Check application logs: `docker-compose logs app`
2. Verify API key configuration
3. Ensure database connectivity
4. Review ChromaDB data directory permissions

## License

This project is built for government contract discovery and analysis. Ensure compliance with SAM.gov terms of service and applicable regulations.
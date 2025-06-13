# Docker Setup Instructions

## Quick Start

1. **Build and run the Docker container:**
```bash
docker run -d --network host \
  -e OPENROUTER_API_KEY=your_openrouter_key \
  -e SAM_GOV_API_KEY=your_sam_gov_key \
  -e DATABASE_URL=postgresql://user:password@localhost:5432/database \
  -e NORSHIN_API_URL=https://norshin.com/api/process-document \
  --name government_contracts eakarsun4/government_contracts
```

2. **Access the application:**
   - Open http://localhost:5000 in your browser
   - Dashboard will show contract counts and processing status

## Setting Up Search Functionality

Your Docker container starts empty. To enable full functionality including search:

### Option 1: Restore Complete Database (Recommended)
```bash
# Connect to your Docker container
docker exec -it government_contracts bash

# Restore complete database with processed documents
python restore_db_snapshot.py
```

This restores:
- 694 government contracts from SAM.gov
- 17 processed documents with Norshin analysis
- Complete search functionality with 138 document chunks

### Option 2: Process Documents from Scratch
1. Click "Queue Documents (Free)" - downloads contract files locally
2. Click "Process Documents ($$)" - sends files to Norshin API for analysis
3. Wait for processing to complete (monitor dashboard counters)
4. Search functionality will be available once documents are processed

Note: Option 1 is recommended to avoid Norshin API costs and get immediate functionality.

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `SAM_GOV_API_KEY` - For fetching government contracts
- `OPENROUTER_API_KEY` - For AI analysis and search

Optional:
- `NORSHIN_API_URL` - Document processing service (defaults to https://norshin.com/api/process-document)

## Database Setup

The application requires PostgreSQL with these tables:
- `contract` - Government contract metadata
- `document_processing_queue` - Document processing status
- `indexing_job` - Background job tracking
- Other supporting tables for users, search queries, etc.

Tables are created automatically on first run.

## Processing Costs

- **Queue Documents**: Free (downloads files only)
- **Process Documents**: Costs money (Norshin API charges per document)
- **Search**: Free once documents are processed

## Troubleshooting

**No search results?**
- Check "Processed Documents" counter on dashboard
- If 0, run document processing first

**Database connection issues?**
- Verify DATABASE_URL format: `postgresql://user:password@host:port/database`
- Ensure PostgreSQL is running and accessible

**Processing failures?**
- Check container logs: `docker logs government_contracts`
- Verify API keys are correct
- Check network connectivity to external APIs
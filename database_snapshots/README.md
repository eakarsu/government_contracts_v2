# Database Snapshots

This folder contains complete PostgreSQL database snapshots from the government contracts processing system.

## Files

- `complete_snapshot.json` - Full database snapshot (1.5MB) containing all tables and data
- `processed_documents_snapshot.json` - 17 successfully processed documents with Norshin analysis (742KB)
- `contracts_snapshot.json` - Sample of 100 contracts with document attachments (115KB)

## Snapshot Contents

### Complete Snapshot
- **694 contracts** from SAM.gov
- **17 processed documents** with full Norshin analysis
- **Search queries, indexing jobs, and system metadata**
- Created: 2025-06-13T13:13:14

### Key Data for Search Functionality
The processed documents contain AI-analyzed content from government contract documents including:
- Solicitation numbers and contract details
- Technical requirements and specifications
- Bid deadlines and submission requirements
- Performance requirements and locations
- Set-aside information (SDVOSB, small business, etc.)

## Usage

### Docker Environment Setup
1. Start your Docker container with PostgreSQL database
2. Run the restore script:
```bash
# Restore complete database
python restore_db_snapshot.py

# Or restore only processed documents for search
python restore_db_snapshot.py --docs-only
```

### Manual Database Restore
Connect to your PostgreSQL database and execute the restoration commands in the Python script.

## Data Structure

### Contracts Table
Contains government contract metadata from SAM.gov with fields like:
- notice_id, title, description
- agency, office, posted_date
- naics_code, set_aside_code
- resource_links (document URLs)

### Document Processing Queue
Tracks document processing status with:
- contract_notice_id (links to contracts)
- document_url, filename
- processed_data (JSON from Norshin analysis)
- status (completed/failed/queued)

## Search Functionality Requirements

For full search capabilities, you need:
1. Contract metadata (from contracts table)
2. Processed document content (from document_processing_queue)
3. Vector database indexing (ChromaDB handles this automatically)

The snapshot provides both requirements 1 and 2, enabling immediate search functionality without reprocessing documents through Norshin API.
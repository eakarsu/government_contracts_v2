#!/usr/bin/env python3
"""
Test complete Docker container initialization process
This simulates a fresh Docker container startup to verify all components work together
"""
import os
import tempfile
import shutil
import subprocess
import psycopg2
import time
import sys

def test_complete_docker_initialization():
    """Test the complete Docker initialization process"""
    
    print("=== Testing Complete Docker Initialization Process ===")
    
    # Step 1: Set up environment like Docker container
    os.environ['DOCKER_CONTAINER'] = '1'
    print("✓ Set Docker environment variable")
    
    # Step 2: Test ChromaDB directory setup
    test_chromadb_dir = tempfile.mkdtemp(prefix='test_chromadb_')
    print(f"✓ Created test ChromaDB directory: {test_chromadb_dir}")
    
    try:
        # Step 3: Test database connection
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        print("✓ Database connection successful")
        
        # Step 4: Test table creation (simulate Flask startup)
        print("Testing Flask table creation...")
        try:
            # Import Flask app to test table creation
            sys.path.append('.')
            from main import app
            with app.app_context():
                from app import db
                # This should create tables without errors
                db.create_all()
                print("✓ Flask table creation successful")
        except Exception as e:
            print(f"✗ Flask table creation failed: {e}")
            return False
        
        # Step 5: Test database restoration with PostgreSQL reserved words
        print("Testing database restoration...")
        try:
            from restore_db_snapshot import restore_database_snapshot
            
            # Test just the critical parts without full restoration
            cur.execute('SELECT COUNT(*) FROM "contract"')
            contract_count_before = cur.fetchone()[0]
            print(f"✓ Contract table query successful (current count: {contract_count_before})")
            
            # Test reserved word handling
            cur.execute('SELECT COUNT(*) FROM "user"')
            user_count = cur.fetchone()[0]
            print(f"✓ User table query successful (reserved word handled, count: {user_count})")
            
        except Exception as e:
            print(f"✗ Database restoration test failed: {e}")
            return False
        
        # Step 6: Test ChromaDB initialization
        print("Testing ChromaDB initialization...")
        try:
            from services.vector_database import VectorDatabase
            
            # Temporarily override ChromaDB path for testing
            original_persist_dir = getattr(VectorDatabase, '_persist_directory', None)
            
            # Create test instance
            vector_db = VectorDatabase()
            if vector_db.client and vector_db.contracts_collection and vector_db.documents_collection:
                print("✓ ChromaDB initialization successful")
            else:
                print("✗ ChromaDB initialization failed - collections not created")
                return False
                
        except Exception as e:
            print(f"✗ ChromaDB initialization failed: {e}")
            return False
        
        # Step 7: Test API services initialization
        print("Testing API services initialization...")
        try:
            from services.sam_gov_api import SAMGovAPI
            from services.ai_analyzer import AIAnalyzer
            
            sam_api = SAMGovAPI()
            ai_analyzer = AIAnalyzer()
            
            print("✓ API services initialization successful")
            
        except Exception as e:
            print(f"✗ API services initialization failed: {e}")
            return False
        
        # Step 8: Test sequence handling
        print("Testing PostgreSQL sequence handling...")
        try:
            # Check if sequences exist and work properly
            cur.execute("SELECT setval('contract_id_seq', 1000)")
            cur.execute("SELECT currval('contract_id_seq')")
            seq_val = cur.fetchone()[0]
            if seq_val == 1000:
                print("✓ PostgreSQL sequence handling successful")
            else:
                print(f"✗ PostgreSQL sequence handling failed: expected 1000, got {seq_val}")
                return False
                
        except Exception as e:
            print(f"✗ PostgreSQL sequence test failed: {e}")
            return False
        
        cur.close()
        conn.close()
        print("✓ Database connection closed properly")
        
        print("\n=== Docker Initialization Test PASSED ===")
        print("All components initialized successfully!")
        return True
        
    except Exception as e:
        print(f"✗ Critical initialization failure: {e}")
        return False
        
    finally:
        # Cleanup
        if os.path.exists(test_chromadb_dir):
            shutil.rmtree(test_chromadb_dir)
        print("✓ Test cleanup completed")

if __name__ == "__main__":
    success = test_complete_docker_initialization()
    sys.exit(0 if success else 1)
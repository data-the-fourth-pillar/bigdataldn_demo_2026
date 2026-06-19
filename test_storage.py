#!/usr/bin/env python3
"""
Test script to verify entity creation works with the new storage system.
This can be run locally to test the /tmp directory logic.
"""

import os
import sys
import json

# Add the project root to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.services.storage_service import storage_service
from backend.models.graph import Entity, EntityCreate
from backend.services.graph_service import graph_service

def test_storage():
    print("=" * 60)
    print("Testing Storage Service")
    print("=" * 60)
    
    # Check storage location
    print(f"\n✓ Storage directory: {storage_service.data_dir}")
    print(f"✓ Graph file: {storage_service.graph_file}")
    print(f"✓ Running on Vercel: {bool(os.environ.get('VERCEL'))}")
    
    # Test entity creation
    print("\n" + "=" * 60)
    print("Testing Entity Creation")
    print("=" * 60)
    
    try:
        test_entity = EntityCreate(
            name="Test Entity",
            type="test",
            description="This is a test entity to verify storage works",
            metadata={"test": True}
        )
        
        created = graph_service.create_entity(test_entity)
        print(f"\n✓ Successfully created entity: {created.id}")
        print(f"  Name: {created.name}")
        print(f"  Type: {created.type}")
        
        # Verify it was saved
        retrieved = graph_service.get_entity(created.id)
        if retrieved:
            print(f"\n✓ Successfully retrieved entity from storage")
        else:
            print(f"\n✗ Failed to retrieve entity from storage")
            
        # Check file exists
        if os.path.exists(storage_service.graph_file):
            with open(storage_service.graph_file, 'r') as f:
                data = json.load(f)
                print(f"\n✓ Graph file exists with {len(data.get('entities', {}))} entities")
        else:
            print(f"\n✗ Graph file does not exist")
            
        # Clean up test entity
        graph_service.delete_entity(created.id)
        print(f"\n✓ Cleaned up test entity")
        
        print("\n" + "=" * 60)
        print("✅ All tests passed!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    # Optionally simulate Vercel environment
    if len(sys.argv) > 1 and sys.argv[1] == "--vercel":
        os.environ['VERCEL'] = '1'
        print("🔧 Simulating Vercel environment (using /tmp)")
    
    test_storage()

// Test file to verify shared folder compilation works
import { CRDTDatabase, createTestDatabase } from '@crdtdemo/shared';

/**
 * Simple test to verify shared imports compile correctly
 */
export function testSharedImport(): boolean {
  try {
    const db = new CRDTDatabase('test-agent', 'test-replica');
    const info = db.getInfo();
    
    console.log('✅ Shared import test passed:', info);
    return info.agentId === 'test-agent' && info.replicaId === 'test-replica';
  } catch (error) {
    console.error('❌ Shared import test failed:', error);
    return false;
  }
}

/**
 * Test using utility function
 */
export function testUtilityFunction(): boolean {
  try {
    const db = createTestDatabase('util-agent', 'util-replica');
    const info = db.getInfo();
    
    console.log('✅ Utility function test passed:', info);
    return true;
  } catch (error) {
    console.error('❌ Utility function test failed:', error);
    return false;
  }
}

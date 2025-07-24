const { query } = require('./config/database');

async function checkDatabaseSchema() {
  try {
    console.log('🔍 Checking actual database schema...');
    
    // Get all table names
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('📊 Actual tables in database:');
    tables.rows.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    
    // Get detailed schema for key tables
    const keyTables = ['contracts', 'rfp_responses', 'rfp_templates', 'company_profiles'];
    
    for (const tableName of keyTables) {
      try {
        const columns = await query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = $1 AND table_schema = 'public'
          ORDER BY ordinal_position;
        `, [tableName]);
        
        if (columns.rows.length > 0) {
          console.log(`\n📋 ${tableName} schema:`);
          columns.rows.forEach(col => {
            console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default || ''}`);
          });
        }
      } catch (error) {
        console.log(`❌ Error getting schema for ${tableName}:`, error.message);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking database:', error);
    process.exit(1);
  }
}

checkDatabaseSchema();
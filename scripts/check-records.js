const { db } = require('../utils/database');

db.all('SELECT COUNT(*) as count FROM technical_analysis_records;', (err, rows) => {
  if (err) {
    console.error('Error:', err.message);
  } else {
    console.log('Technical analysis records in database:', rows[0].count);
    if (rows[0].count > 0) {
      db.all('SELECT symbol, technical_score, calculation_timestamp FROM technical_analysis_records ORDER BY calculation_timestamp DESC LIMIT 5;', (err, records) => {
        if (!err) {
          console.log('Recent records:');
          records.forEach(record => {
            console.log(`  ${record.symbol}: ${record.technical_score} (${record.calculation_timestamp})`);
          });
        }
        db.close();
      });
    } else {
      db.close();
    }
  }
});
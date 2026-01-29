
const DailyUpdateFetcher = require('./utils/daily-update-fetcher');

async function testDoubleStart() {
  const fetcher = new DailyUpdateFetcher();
  await fetcher.initialize();
  
  console.log('First start attempt:');
  fetcher.startDailyScheduler();
  
  console.log('Second start attempt (should be skipped):');
  fetcher.startDailyScheduler();
  
  console.log('Test completed');
}

testDoubleStart();


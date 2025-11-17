import { initializeSearchIndex } from '../src/config/azureClients.js';
import dotenv from 'dotenv';

dotenv.config();

async function init() {
  try {
    console.log('Initializing search index...');
    await initializeSearchIndex();
    console.log('✅ Search index initialized successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing search index:', error);
    process.exit(1);
  }
}

init();
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables first, before any other imports
config({ path: resolve(process.cwd(), '.env') });

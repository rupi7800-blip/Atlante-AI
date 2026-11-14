import { openDb } from '../db.js';
import { seed } from './index.js';

openDb();
console.log(seed());

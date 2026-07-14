import { scryptSync, randomBytes } from 'crypto';

const password = 'admintuti13';
const salt = randomBytes(32).toString('hex');
const hash = scryptSync(password, salt, 64).toString('hex');
console.log(`passwordHash: ${salt}:${hash}`);

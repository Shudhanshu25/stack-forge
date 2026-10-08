// Grants the ADMIN role to an existing user: npm run promote-admin -w backend -- user@example.com
import mongoose from 'mongoose';
import { loadConfig } from '../config.js';
import { UserModel } from '../modules/auth/user.model.js';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: npm run promote-admin -w backend -- <email>');
  process.exit(1);
}

const config = loadConfig();
await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 5000 });
const result = await UserModel.updateOne({ email }, { $set: { role: 'ADMIN' } });
console.log(result.matchedCount ? `${email} is now ADMIN` : `No user with email ${email}`);
await mongoose.disconnect();
process.exit(result.matchedCount ? 0 : 1);

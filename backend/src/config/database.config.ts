import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  user: process.env.DATABASE_USER || 'wang',
  pass: process.env.DATABASE_PASS || '',
  name: process.env.DATABASE_NAME || 'shadowing_dev',
}));

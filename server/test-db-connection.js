const { PrismaClient } = require("@prisma/client");

async function testConnection() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || "sqlserver://localhost:1433;database=print_center;user=sa;password=MyPassword123#;trustServerCertificate=true"
      }
    },
    log: ['query', 'info', 'warn', 'error'],
  });

  try {
    console.log('🔌 Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connected successfully!');
    
    // Test a simple query
    console.log('🔍 Testing a simple query...');
    const userCount = await prisma.users.count();
    console.log(`✅ Query successful! Found ${userCount} users in the database.`);
    
    await prisma.$disconnect();
    console.log('✅ Database disconnected successfully!');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

testConnection(); 
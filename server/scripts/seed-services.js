const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedServices() {
  try {
    // Check if Document Printing service exists
    const existingService = await prisma.services.findUnique({
      where: { name: 'Document Printing' }
    });

    if (!existingService) {
      // Create Document Printing service
      await prisma.services.create({
        data: {
          name: 'Document Printing',
          description: 'High-quality document printing service with various options including color, paper size, and double-sided printing.',
          price: 0.10 // Base price per page
        }
      });
      console.log('Document Printing service created successfully');
    } else {
      console.log('Document Printing service already exists');
    }
  } catch (error) {
    console.error('Error seeding services:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedServices(); 
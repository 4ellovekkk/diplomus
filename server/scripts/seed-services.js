const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedServices() {
  try {
    // Check if Document Printing service exists
    let service = await prisma.services.findUnique({
      where: { name: 'Document Printing' }
    });

    if (!service) {
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

    // Check if Custom T-Shirt service exists
    service = await prisma.services.findUnique({
      where: { name: 'Custom T-Shirt' }
    });

    if (!service) {
      // Create Custom T-Shirt service
      await prisma.services.create({
        data: {
          name: 'Custom T-Shirt',
          description: 'Custom designed t-shirt with your text and images.',
          price: 149.99 // Fixed price per t-shirt
        }
      });
      console.log('Custom T-Shirt service created successfully');
    } else {
      console.log('Custom T-Shirt service already exists');
    }
  } catch (error) {
    console.error('Error seeding services:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedServices(); 
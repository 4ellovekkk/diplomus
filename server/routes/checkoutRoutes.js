const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const verifyTokenExceptLogin = require("../middleware/authMiddleware");
const jwt = require("jsonwebtoken");

const ORDER_STATUS = {
  PENDING: 1,     // Initial status when order is created
  PROCESSING: 2,  // When payment is being processed
  COMPLETED: 3,   // When payment is successful
  CANCELLED: 4    // When payment fails or order is cancelled
};

// Helper function to format cart items for Stripe
const formatLineItems = (cart) => {
  return cart.map(item => {
    // Extract only essential options for metadata
    const essentialOptions = {};
    if (item.options) {
      const options = typeof item.options === 'string' ? JSON.parse(item.options) : item.options;
      // Include only basic printing options, not the file content
      if (options.filename) essentialOptions.filename = options.filename;
      if (options.pages) essentialOptions.pages = options.pages;
      if (options.color) essentialOptions.color = options.color;
      if (options.paper_size) essentialOptions.paper_size = options.paper_size;
      if (options.double_sided) essentialOptions.double_sided = options.double_sided;
      if (options.size) essentialOptions.size = options.size; // For t-shirts
    }

    // Create a product with metadata first
    const product = {
      name: item.name,
      description: item.service_description || 'Custom designed t-shirt',
      metadata: {
        type: item.type || 'service',
        service_id: item.service_id?.toString() || '',
        name: item.name,
        description: item.service_description || 'Custom designed t-shirt',
        options: JSON.stringify(essentialOptions)
      }
    };

    return {
      price_data: {
        currency: 'usd',
        product_data: product,
        unit_amount: Math.round(item.price * 100), // Convert to cents
      },
      quantity: item.quantity,
    };
  });
};

// Create checkout session
router.post("/create-checkout-session", verifyTokenExceptLogin, async (req, res) => {
  try {
    console.log('Starting checkout session creation...');
    
    // Validate DOMAIN environment variable
    const domain = process.env.DOMAIN || 'https://localhost:3000';
    console.log('Using domain:', domain);
    
    if (!req.session.cart || req.session.cart.length === 0) {
      console.log('Cart is empty');
      return res.status(400).json({ error: req.__("cart_empty") });
    }

    console.log('Cart contents:', JSON.stringify(req.session.cart, null, 2));

    // Get user details
    const decoded = req.user;
    console.log('User ID from token:', decoded.userId);

    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      console.log('User not found:', decoded.userId);
      return res.status(404).json({ error: req.__("user_not_found") });
    }

    // Get the current token from the request
    const currentToken = req.cookies.token || req.headers["authorization"] || req.query.token;

    console.log('User found:', user.email);

    // Format line items and log them
    const lineItems = formatLineItems(req.session.cart);
    console.log('Formatted line items:', JSON.stringify(lineItems, null, 2));

    // Create Stripe checkout session with token in URLs
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      customer_email: user.email,
      mode: 'payment',
      success_url: `${domain}/checkout/success?session_id={CHECKOUT_SESSION_ID}&token=${currentToken}`,
      cancel_url: `${domain}/?token=${currentToken}&payment_cancelled=true`,
      metadata: {
        user_id: user.id.toString(),
      },
    });

    console.log('Stripe session created:', session.id);
    res.json({ url: session.url });
  } catch (error) {
    console.error('Detailed error creating checkout session:', {
      message: error.message,
      type: error.type,
      code: error.code,
      param: error.param,
      detail: error.detail,
      stack: error.stack
    });
    res.status(500).json({ error: req.__("checkout_error") });
  }
});

// Checkout success route
router.get("/success", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.query.session_id, {
      expand: ['payment_intent', 'line_items']
    });
    const token = req.query.token;
    
    if (session.payment_status !== 'paid') {
      return res.redirect(`/?token=${token}&payment_failed=true`);
    }

    // Get the user ID from the session metadata
    const userId = parseInt(session.metadata.user_id);

    // Start a transaction
    const result = await prisma.$transaction(async (prisma) => {
      // 1. Create order first
      const order = await prisma.orders.create({
        data: {
          user_id: userId,
          total_price: session.amount_total / 100,
          status_id: ORDER_STATUS.COMPLETED,
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      // 2. Create payment record with order relation and address details
      const payment = await prisma.payments.create({
        data: {
          payment_method: 'stripe',
          amount: session.amount_total / 100,
          payment_status: 'completed',
          stripe_payment_id: session.payment_intent.id,
          stripe_session_id: session.id,
          created_at: new Date(),
          updated_at: new Date(),
          currency: session.currency,
          payment_details: JSON.stringify({
            payment_method_types: session.payment_method_types,
            customer_email: session.customer_email,
            customer_details: session.customer_details,
            shipping_address: session.shipping,
            billing_address: session.customer_details?.address || null
          })
        }
      });

      // 3. Update order with payment ID
      await prisma.orders.update({
        where: { id: order.id },
        data: { 
          payment_id: payment.id,
          updated_at: new Date()
        }
      });

      // 4. Create order items
      const lineItems = session.line_items.data;
      console.log('Line items from Stripe:', JSON.stringify(lineItems, null, 2));

      const orderItems = await Promise.all(
        lineItems.map(async (item) => {
          console.log('Processing line item:', JSON.stringify(item, null, 2));
          
          // Expand the product to get its metadata
          const product = await stripe.products.retrieve(item.price.product);
          console.log('Product data:', JSON.stringify(product, null, 2));
          
          const metadata = product.metadata || {};
          console.log('Item metadata:', metadata);

          const options = {};
          
          try {
            // Only parse options if it exists and is a valid JSON string
            if (metadata.options) {
              Object.assign(options, JSON.parse(metadata.options));
            }
          } catch (e) {
            console.warn('Failed to parse options metadata:', e);
          }

          // Get product name and description from metadata or product data
          const productName = metadata.name || product.name || 'Unknown Product';
          const productDescription = metadata.description || product.description || null;
          const productType = metadata.type || 'service';
          
          // Try to get service_id from metadata
          let serviceId = null;
          
          if (metadata.service_id) {
            serviceId = parseInt(metadata.service_id);
          }
          
          // If service_id not found and it's a merch item, use the merchandise service ID
          if (!serviceId && productType === 'merch') {
            serviceId = 2; // Use the existing merchandise service ID
          }
          
          // If still not found and it's a service, try to find by name
          if (!serviceId && productType === 'service') {
            const service = await prisma.services.findUnique({
              where: { name: productName }
            });
            if (service) {
              serviceId = service.id;
            }
          }

          // If still not found, throw error with more details
          if (!serviceId) {
            console.error('Failed to find service for product:', {
              productName,
              productDescription,
              metadata,
              product: product.id
            });
            throw new Error(`Could not find service for product: ${productName}. Please ensure the service exists in the database.`);
          }

          // Verify service exists in database
          const service = await prisma.services.findUnique({
            where: { id: serviceId }
          });

          if (!service) {
            throw new Error(`Service with ID ${serviceId} not found for line item: ${productName}`);
          }
          
          return prisma.order_items.create({
            data: {
              order_id: order.id,
              service_id: serviceId,
              quantity: item.quantity || 1,
              price: (item.price?.unit_amount || 0) / 100,
              options: JSON.stringify({
                ...options,
                type: productType,
                item_name: productName,
                item_description: productDescription
              }),
              subtotal: ((item.price?.unit_amount || 0) * (item.quantity || 1)) / 100,
              created_at: new Date(),
              updated_at: new Date()
            }
          });
        })
      );

      return { order, payment, orderItems };
    });

    // Clear the cart and save success message
    req.session.cart = [];
    req.session.cartSuccess = req.__("order_success");
    await req.session.save();

    // Log the successful order creation
    console.log('Order created successfully:', {
      orderId: result.order.id,
      paymentId: result.payment.id,
      items: result.orderItems.length
    });

    // Redirect to homepage with success message
    res.redirect(`/?token=${token}&payment_success=true&order_id=${result.order.id}`);
  } catch (error) {
    console.error('Error processing successful payment:', error);
    console.error('Detailed error:', {
      name: error.name,
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack
    });
    req.session.cartError = req.__("order_error");
    const token = req.query.token || '';
    res.redirect(`/?token=${token}&payment_error=true`);
  }
});

// Stripe webhook handler
router.post("/webhook", async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('Missing STRIPE_WEBHOOK_SECRET environment variable');
      return res.status(500).send('Webhook Error: Missing webhook secret');
    }

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        webhookSecret
      );
      
      console.log('Event constructed successfully:', event.type);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    console.log(`Processing webhook event: ${event.type}`);
    
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('Processing completed session:', session.id);
        
        try {
          // Find orders with a payment matching this payment intent
          const orders = await prisma.orders.findMany({
            where: {
              payment: {
                payment_status: {
                  not: "completed"
                }
              },
              status_id: {
                not: 3
              }
            },
            include: {
              payment: true
            }
          });

          // Update the found orders
          for (const order of orders) {
            await prisma.orders.update({
              where: { id: order.id },
              data: {
                status_id: ORDER_STATUS.COMPLETED,
                payment: {
                  updateMany: {
                    where: { order_id: order.id },
                    data: { payment_status: 'completed' }
                  }
                }
              }
            });
          }
          console.log(`Orders updated successfully for session: ${session.id}`);
        } catch (error) {
          console.error('Error updating order:', error);
        }
        break;
        
      case 'payment_intent.payment_failed':
        const failedPaymentIntent = event.data.object;
        console.log('Processing failed payment:', failedPaymentIntent.id);
        
        try {
          // Find and update orders with failed payments
          const orders = await prisma.orders.findMany({
            where: {
              payment: {
                payment_status: {
                  not: "completed"
                }
              }
            },
            include: {
              payment: true
            }
          });

          for (const order of orders) {
            await prisma.orders.update({
              where: { id: order.id },
              data: {
                status_id: ORDER_STATUS.CANCELLED,
                payment: {
                  updateMany: {
                    where: { order_id: order.id },
                    data: { payment_status: 'failed' }
                  }
                }
              }
            });
          }
          console.log(`Orders marked as cancelled for payment intent: ${failedPaymentIntent.id}`);
        } catch (error) {
          console.error('Error updating failed order:', error);
        }
        break;

      case 'charge.succeeded':
        const successfulCharge = event.data.object;
        console.log('Processing successful charge:', successfulCharge.id);
        try {
          // Update orders with successful charges
          const orders = await prisma.orders.findMany({
            where: {
              payment: {
                payment_status: {
                  not: "completed"
                }
              },
              status_id: {
                not: 3
              }
            },
            include: {
              payment: true
            }
          });

          for (const order of orders) {
            await prisma.orders.update({
              where: { id: order.id },
              data: {
                status_id: ORDER_STATUS.COMPLETED,
                payment: {
                  updateMany: {
                    where: { order_id: order.id },
                    data: { payment_status: 'completed' }
                  }
                }
              }
            });
          }
          console.log(`Orders updated for successful charge: ${successfulCharge.id}`);
        } catch (error) {
          console.error('Error processing successful charge:', error);
        }
        break;

      case 'charge.updated':
        const updatedCharge = event.data.object;
        console.log('Processing charge update:', updatedCharge.id);
        try {
          if (updatedCharge.status === 'succeeded') {
            // Update orders for successful charges
            const orders = await prisma.orders.findMany({
              where: {
                payment: {
                  payment_status: {
                    not: "completed"
                  }
                },
                status_id: {
                  not: 3
                }
              },
              include: {
                payment: true
              }
            });

            for (const order of orders) {
              await prisma.orders.update({
                where: { id: order.id },
                data: {
                  status_id: ORDER_STATUS.COMPLETED,
                  payment: {
                    updateMany: {
                      where: { order_id: order.id },
                      data: { payment_status: 'completed' }
                    }
                  }
                }
              });
            }
            console.log(`Orders updated for charge update: ${updatedCharge.id}`);
          } else if (updatedCharge.status === 'failed') {
            // Update orders for failed charges
            const orders = await prisma.orders.findMany({
              where: {
                payment: {
                  payment_status: {
                    not: "failed"
                  }
                },
                status_id: {
                  not: 4
                }
              },
              include: {
                payment: true
              }
            });

            for (const order of orders) {
              await prisma.orders.update({
                where: { id: order.id },
                data: {
                  status_id: ORDER_STATUS.CANCELLED,
                  payment: {
                    updateMany: {
                      where: { order_id: order.id },
                      data: { payment_status: 'failed' }
                    }
                  }
                }
              });
            }
            console.log(`Orders marked as cancelled for failed charge: ${updatedCharge.id}`);
          } else {
            console.log(`No order update needed for charge status: ${updatedCharge.status}`);
          }
        } catch (error) {
          console.error('Error processing charge update:', error);
        }
        break;

      case 'payment_intent.succeeded':
        const successfulPaymentIntent = event.data.object;
        console.log('Processing successful payment intent:', successfulPaymentIntent.id);
        try {
          // Update orders with successful payment intents
          const orders = await prisma.orders.findMany({
            where: {
              payment: {
                payment_status: {
                  not: "completed"
                }
              },
              status_id: {
                not: 3
              }
            },
            include: {
              payment: true
            }
          });

          for (const order of orders) {
            await prisma.orders.update({
              where: { id: order.id },
              data: {
                status_id: ORDER_STATUS.COMPLETED,
                payment: {
                  updateMany: {
                    where: { order_id: order.id },
                    data: { payment_status: 'completed' }
                  }
                }
              }
            });
          }
          console.log(`Orders updated for successful payment: ${successfulPaymentIntent.id}`);
        } catch (error) {
          console.error('Error processing successful payment:', error);
        }
        break;

      case 'payment_intent.created':
        const createdPaymentIntent = event.data.object;
        console.log('New payment intent created:', createdPaymentIntent.id);
        // No action needed for payment_intent.created, just log it
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.json({received: true, type: event.type});
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send(`Webhook Error: ${error.message}`);
  }
});

// Get user orders
router.get("/user-orders", verifyTokenExceptLogin, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Fetch all orders for the user with related data
    const orders = await prisma.orders.findMany({
      where: {
        user_id: userId
      },
      include: {
        status: true,
        payment: true,
        order_items: {
          include: {
            service: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // Format the orders data
    const formattedOrders = orders.map(order => ({
      id: order.id,
      total_price: parseFloat(order.total_price.toString()),
      status: order.status.name,
      created_at: order.created_at,
      updated_at: order.updated_at,
      payment_status: order.payment?.payment_status || 'pending',
      items: order.order_items.map(item => ({
        service_name: item.service.name,
        quantity: item.quantity,
        price: parseFloat(item.price.toString()),
        subtotal: parseFloat(item.subtotal.toString()),
        options: JSON.parse(item.options || '{}')
      }))
    }));

    res.json({
      success: true,
      orders: formattedOrders
    });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({
      success: false,
      error: req.__("fetch_orders_error") || 'Error fetching orders'
    });
  }
});

module.exports = router; 
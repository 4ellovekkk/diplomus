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
    }

    const productData = {
      name: item.name,
      metadata: {
        service_id: item.service_id,
        options: JSON.stringify(essentialOptions)
      }
    };

    // Only add description if it exists and is not empty
    if (item.service_description) {
      productData.description = item.service_description;
    }

    return {
      price_data: {
        currency: 'usd',
        product_data: productData,
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
    const session = await stripe.checkout.sessions.retrieve(req.query.session_id);
    const token = req.query.token;
    
    if (session.payment_status !== 'paid') {
      return res.redirect(`/?token=${token}&payment_failed=true`);
    }

    // Get the user ID from the session metadata
    const userId = parseInt(session.metadata.user_id);
    
    // Create order in database with COMPLETED status
    const order = await prisma.orders.create({
      data: {
        user_id: userId,
        total_price: session.amount_total / 100,
        status_id: ORDER_STATUS.COMPLETED,
        payments: {
          create: {
            payment_method: 'card',
            amount: session.amount_total / 100,
            payment_status: 'completed'
          }
        },
        items: {
          create: req.session.cart.map(item => ({
            service_id: item.service_id,
            quantity: item.quantity,
            price: item.price,
            options: item.options
          }))
        }
      }
    });

    // Clear the cart
    req.session.cart = [];
    req.session.cartSuccess = req.__("order_success");
    await req.session.save();

    // Redirect to homepage with success message
    res.redirect(`/?token=${token}&payment_success=true&order_id=${order.id}`);
  } catch (error) {
    console.error('Error processing successful payment:', error);
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
              payments: {
                some: {
                  payment_status: { not: 'completed' }
                }
              },
              status_id: { not: ORDER_STATUS.COMPLETED }
            },
            include: {
              payments: true
            }
          });

          // Update the found orders
          for (const order of orders) {
            await prisma.orders.update({
              where: { id: order.id },
              data: {
                status_id: ORDER_STATUS.COMPLETED,
                payments: {
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
              payments: {
                some: {
                  payment_status: { not: 'failed' }
                }
              }
            },
            include: {
              payments: true
            }
          });

          for (const order of orders) {
            await prisma.orders.update({
              where: { id: order.id },
              data: {
                status_id: ORDER_STATUS.CANCELLED,
                payments: {
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
              payments: {
                some: {
                  payment_status: { not: 'completed' }
                }
              },
              status_id: { not: ORDER_STATUS.COMPLETED }
            },
            include: {
              payments: true
            }
          });

          for (const order of orders) {
            await prisma.orders.update({
              where: { id: order.id },
              data: {
                status_id: ORDER_STATUS.COMPLETED,
                payments: {
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
                payments: {
                  some: {
                    payment_status: { not: 'completed' }
                  }
                },
                status_id: { not: ORDER_STATUS.COMPLETED }
              },
              include: {
                payments: true
              }
            });

            for (const order of orders) {
              await prisma.orders.update({
                where: { id: order.id },
                data: {
                  status_id: ORDER_STATUS.COMPLETED,
                  payments: {
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
                payments: {
                  some: {
                    payment_status: { not: 'failed' }
                  }
                },
                status_id: { not: ORDER_STATUS.CANCELLED }
              },
              include: {
                payments: true
              }
            });

            for (const order of orders) {
              await prisma.orders.update({
                where: { id: order.id },
                data: {
                  status_id: ORDER_STATUS.CANCELLED,
                  payments: {
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
              payments: {
                some: {
                  payment_status: { not: 'completed' }
                }
              },
              status_id: { not: ORDER_STATUS.COMPLETED }
            },
            include: {
              payments: true
            }
          });

          for (const order of orders) {
            await prisma.orders.update({
              where: { id: order.id },
              data: {
                status_id: ORDER_STATUS.COMPLETED,
                payments: {
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

module.exports = router; 
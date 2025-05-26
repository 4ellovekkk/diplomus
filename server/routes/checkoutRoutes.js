const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const verifyTokenExceptLogin = require("../middleware/authMiddleware");
const jwt = require("jsonwebtoken");
const PrintFile = require("../models_mongo/printFile");
const MerchDesign = require("../models_mongo/merchDesign");

const ORDER_STATUS = {
  PENDING: 1,     // Initial status when order is created
  PROCESSING: 2,  // When payment is successful and order is in printing queue
  COMPLETED: 3,   // When order is printed and completed
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

    // Store the full cart data in the session for later use
    req.session.pendingCart = JSON.parse(JSON.stringify(req.session.cart));

    // Create a simplified version of the cart for metadata
    const metadataCart = req.session.cart.map(item => {
      const { options, ...rest } = item;
      const simplifiedOptions = {};
      
      if (options) {
        const opts = typeof options === 'string' ? JSON.parse(options) : options;
        // Only include essential options, excluding file and design data
        if (opts.size) simplifiedOptions.size = opts.size;
        if (opts.text) simplifiedOptions.text = opts.text;
        if (opts.textColor) simplifiedOptions.textColor = opts.textColor;
        if (opts.fontSize) simplifiedOptions.fontSize = opts.fontSize;
        if (opts.position) simplifiedOptions.position = opts.position;
        if (opts.imagePosition) simplifiedOptions.imagePosition = opts.imagePosition;
        if (opts.imageSize) simplifiedOptions.imageSize = opts.imageSize;
      }
      
      return {
        ...rest,
        options: simplifiedOptions
      };
    });

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
        cart: JSON.stringify(metadataCart) // Store simplified cart data in metadata
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
    
    // Use the full cart data from the session
    const cartData = req.session.pendingCart || [];
    console.log('Processing cart data:', JSON.stringify(cartData, null, 2));

    // Start a transaction
    const result = await prisma.$transaction(async (prisma) => {
      // 1. Create order first
      const order = await prisma.orders.create({
        data: {
          user_id: userId,
          total_price: session.amount_total / 100,
          status_id: ORDER_STATUS.PROCESSING,
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      // Get the payment intent and its latest charge to access the receipt URL
      const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent.id);
      const charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
      
      // 2. Create payment record with order relation and address details
      const payment = await prisma.payments.create({
        data: {
          payment_method: 'stripe',
          amount: session.amount_total / 100,
          payment_status: 'completed',
          stripe_payment_id: session.payment_intent.id,
          stripe_session_id: session.id,
          receipt_url: charge?.receipt_url || null,
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

      // 4. Create order items and store files in MongoDB
      const orderItems = await Promise.all(
        cartData.map(async (cartItem) => {
          const options = typeof cartItem.options === 'string' ? 
            JSON.parse(cartItem.options) : cartItem.options;

          console.log('Processing cart item:', {
            type: cartItem.type,
            options: JSON.stringify(options)
          });

          // Create order item
          const orderItemOptions = {
            type: cartItem.type || 'service',
            ...(options.filename && { filename: options.filename }),
            ...(options.pages && { pages: options.pages }),
            ...(options.color && { color: options.color }),
            ...(options.paper_size && { paper_size: options.paper_size }),
            ...(options.double_sided && { double_sided: options.double_sided }),
            ...(options.size && { size: options.size }),
            ...(options.text && { text: options.text }),
            ...(options.textColor && { textColor: options.textColor }),
            ...(options.fontSize && { fontSize: options.fontSize }),
            ...(options.position && { position: options.position }),
            ...(options.imagePosition && { imagePosition: options.imagePosition }),
            ...(options.imageSize && { imageSize: options.imageSize })
          };

          const orderItem = await prisma.order_items.create({
            data: {
              quantity: cartItem.quantity || 1,
              price: cartItem.price,
              options: JSON.stringify(orderItemOptions),
              subtotal: cartItem.price * (cartItem.quantity || 1),
              created_at: new Date(),
              updated_at: new Date(),
              order: {
                connect: { id: order.id }
              },
              service: {
                connect: { 
                  id: cartItem.type === 'merch' ? 2 : 1
                }
              }
            }
          });

          // If this is a print order with a file, store it in MongoDB
          if (!cartItem.type && cartItem.service_id === 1 && options.file) { // Document Printing service
            await PrintFile.create({
              orderId: order.id,
              orderItemId: orderItem.id,
              filename: options.filename,
              contentType: options.file.mimetype,
              data: Buffer.from(options.file.buffer, 'base64'),
            });
          }
          
          // If this is a merch order with a design, store it in MongoDB
          if (cartItem.type === 'merch' && options.design) {
            console.log('Storing merch design:', {
              orderId: order.id,
              orderItemId: orderItem.id,
              hasDesign: !!options.design
            });

            await MerchDesign.create({
              orderId: order.id,
              orderItemId: orderItem.id,
              filename: `design_${order.id}_${orderItem.id}.png`,
              contentType: 'image/png',
              data: Buffer.from(options.design.split(',')[1], 'base64'),
              designType: options.text ? 'text' : 'image',
              designDetails: {
                text: options.text || null,
                textColor: options.textColor || null,
                fontSize: options.fontSize || null,
                position: options.position || null,
                imagePosition: options.imagePosition || null,
                imageSize: options.imageSize || null
              }
            });

            console.log('Merch design stored successfully');
          }

          return orderItem;
        })
      );

      return { order, payment, orderItems };
    });

    // Clear both cart and pendingCart from session
    req.session.cart = [];
    req.session.pendingCart = [];
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
                not: ORDER_STATUS.PROCESSING
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
                status_id: ORDER_STATUS.PROCESSING,
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
                not: ORDER_STATUS.PROCESSING
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
                status_id: ORDER_STATUS.PROCESSING,
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
                  not: ORDER_STATUS.PROCESSING
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
                  status_id: ORDER_STATUS.PROCESSING,
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
                not: ORDER_STATUS.PROCESSING
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
                status_id: ORDER_STATUS.PROCESSING,
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
      receipt_url: order.payment?.receipt_url || null,
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
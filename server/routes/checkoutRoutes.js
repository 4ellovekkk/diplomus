const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const verifyTokenExceptLogin = require("../middleware/authMiddleware");

// Helper function to format cart items for Stripe
const formatLineItems = (cart) => {
  return cart.map(item => ({
    price_data: {
      currency: 'usd',
      product_data: {
        name: item.name,
        description: item.service_description || '',
        metadata: {
          service_id: item.service_id,
          options: JSON.stringify(item.options)
        }
      },
      unit_amount: Math.round(item.price * 100), // Convert to cents
    },
    quantity: item.quantity,
  }));
};

// Create checkout session
router.post("/create-checkout-session", verifyTokenExceptLogin, async (req, res) => {
  try {
    if (!req.session.cart || req.session.cart.length === 0) {
      return res.status(400).json({ error: req.__("cart_empty") });
    }

    // Get user details
    const decoded = req.user;
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(404).json({ error: req.__("user_not_found") });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: formatLineItems(req.session.cart),
      customer_email: user.email,
      mode: 'payment',
      success_url: `${process.env.DOMAIN}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.DOMAIN}/profile#cart`,
      metadata: {
        user_id: user.id.toString(),
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: req.__("checkout_error") });
  }
});

// Checkout success route
router.get("/success", verifyTokenExceptLogin, async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.query.session_id);
    
    if (session.payment_status !== 'paid') {
      return res.redirect('/profile#cart');
    }

    // Create order in database
    const order = await prisma.orders.create({
      data: {
        user_id: parseInt(session.metadata.user_id),
        total_amount: session.amount_total / 100, // Convert from cents
        payment_id: session.payment_intent,
        status: 'completed',
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

    res.redirect('/profile#orders');
  } catch (error) {
    console.error('Error processing successful payment:', error);
    req.session.cartError = req.__("order_error");
    res.redirect('/profile#cart');
  }
});

// Stripe webhook handler
router.post("/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        
        // Update order status if needed
        await prisma.orders.updateMany({
          where: {
            payment_id: session.payment_intent,
            status: { not: 'completed' }
          },
          data: {
            status: 'completed'
          }
        });
        break;
        
      case 'payment_intent.payment_failed':
        const paymentIntent = event.data.object;
        
        // Update order status
        await prisma.orders.updateMany({
          where: {
            payment_id: paymentIntent.id
          },
          data: {
            status: 'failed'
          }
        });
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Webhook processing failed');
  }
});

module.exports = router; 
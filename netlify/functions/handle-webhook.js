const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');
const nodemailer = require('nodemailer');

// Debug: Log environment variables to confirm they're set
console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY);
console.log('STRIPE_WEBHOOK_SECRET:', process.env.STRIPE_WEBHOOK_SECRET);
console.log('GMAIL_USER:', process.env.GMAIL_USER);
console.log('GMAIL_PASS:', process.env.GMAIL_PASS);

// Set up the Gmail transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

exports.handler = async (event) => {
  try {
    // Verify the webhook signature
    const sig = event.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // Debug: Log the webhook secret
    console.log('Webhook Secret being used:', webhookSecret);
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is undefined');
    }

    const stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);

    // Handle the payment_intent.succeeded event
    if (stripeEvent.type === 'payment_intent.succeeded') {
      const paymentIntent = stripeEvent.data.object;
      const email = paymentIntent.receipt_email;

      if (!email) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Email not provided in PaymentIntent' })
        };
      }

      // Download the PDF
      const pdfUrl = 'https://drive.google.com/uc?export=download&id=YOUR_FILE_ID'; // Replace with your direct download URL
      const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
      const pdfBuffer = Buffer.from(response.data);

      // Send the email with the PDF attachment
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: email,
        subject: 'Receipt - Your Sheet Music Purchase',
        text: `Thank you for your purchase of $1.00! Your sheet music is attached.\n\nTransaction ID: ${paymentIntent.id}\nDate: ${new Date(paymentIntent.created * 1000).toISOString()}`,
        html: `<p>Thank you for your purchase of $1.00! Your sheet music is attached.</p><p><strong>Transaction ID:</strong> ${paymentIntent.id}</p><p><strong>Date:</strong> ${new Date(paymentIntent.created * 1000).toISOString()}</p>`,
        attachments: [
          {
            filename: 'sheet_music.pdf',
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      };

      await transporter.sendMail(mailOptions);
      console.log('Email sent successfully to:', email);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true })
    };
  } catch (error) {
    console.error('Webhook error:', error.message, error.stack);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: error.message || 'Webhook error' })
    };
  }
};

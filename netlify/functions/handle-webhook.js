const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const mailgun = require('mailgun-js');
const axios = require('axios');

const mg = mailgun({
  apiKey: process.env.MAILGUN_API_KEY.replace('key-', ''),
  domain: process.env.MAILGUN_DOMAIN
});

exports.handler = async (event) => {
  try {
    // Verify the webhook signature
    const sig = event.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
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
      const data = {
        from: 'tommynick979@gmail.com',
        to: email,
        subject: 'Receipt - Your Sheet Music Purchase',
        text: `Thank you for your purchase of $1.00! Your sheet music is attached.\n\nTransaction ID: ${paymentIntent.id}\nDate: ${new Date(paymentIntent.created * 1000).toISOString()}`,
        html: `<p>Thank you for your purchase of $1.00! Your sheet music is attached.</p><p><strong>Transaction ID:</strong> ${paymentIntent.id}</p><p><strong>Date:</strong> ${new Date(paymentIntent.created * 1000).toISOString()}</p>`,
        attachment: {
          data: pdfBuffer,
          filename: 'sheet_music.pdf',
          contentType: 'application/pdf'
        }
      };

      await mg.messages().send(data);
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

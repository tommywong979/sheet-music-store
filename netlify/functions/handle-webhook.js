const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');
const nodemailer = require('nodemailer');

// Debug: Log environment variables
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

// Verify the transporter setup
transporter.verify((error, success) => {
  if (error) {
    console.error('Transporter verification failed:', error.message);
  } else {
    console.log('Transporter is ready to send emails');
  }
});

exports.handler = async (event) => {
  try {
    // Verify the webhook signature
    const sig = event.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

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
      const pdfUrl = 'https://tommywongsheetmusic.netlify.app/sheet-music.pdf'; // Updated to Netlify URL
      let pdfBuffer;
      try {
        console.log('Attempting to download PDF from:', pdfUrl);
        const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
        console.log('PDF downloaded successfully, size:', response.data.length);
        pdfBuffer = Buffer.from(response.data);
      } catch (error) {
        console.error('PDF download failed:', error.message, error.response?.status);
        throw new Error('Failed to download PDF');
      }

      // Send the email with the PDF attachment
      const amount = (paymentIntent.amount / 100).toFixed(2);
      const currency = paymentIntent.currency.toUpperCase();
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: email,
        subject: 'Receipt - Your Sheet Music Purchase',
        text: `Thank you for your purchase of ${currency} ${amount}! Your sheet music is attached.\n\nTransaction ID: ${paymentIntent.id}\nDate: ${new Date(paymentIntent.created * 1000).toISOString()}`,
        html: `<p>Thank you for your purchase of ${currency} ${amount}! Your sheet music is attached.</p><p><strong>Transaction ID:</strong> ${paymentIntent.id}</p><p><strong>Date:</strong> ${new Date(paymentIntent.created * 1000).toISOString()}</p>`,
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

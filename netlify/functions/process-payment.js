const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const axios = require('axios');
const mailgun = require('mailgun-js');

const mg = mailgun({
  apiKey: process.env.MAILGUN_API_KEY.replace('key-', ''), // Remove 'key-' prefix
  domain: process.env.MAILGUN_DOMAIN
});

exports.handler = async (event) => {
  try {
    const { email } = JSON.parse(event.body);

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email is required' })
      };
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000,
      currency: 'usd',
      payment_method_types: ['card'],
      receipt_email: email
    });

    const pdfUrl = 'https://drive.google.com/uc?export=download&id=YOUR_FILE_ID'; // Replace with your direct download URL
    const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
    const pdfBuffer = Buffer.from(response.data);

    const data = {
      from: 'tommynick979@gmail.com',
      to: email,
      subject: 'Your Sheet Music Purchase',
      text: 'Thank you for your purchase! Your sheet music is attached.',
      html: '<p>Thank you for your purchase! Your sheet music is attached.</p>',
      attachment: {
        data: pdfBuffer,
        filename: 'sheet_music.pdf',
        contentType: 'application/pdf'
      }
    };

    await mg.messages().send(data);

    return {
      statusCode: 200,
      body: JSON.stringify({ clientSecret: paymentIntent.client_secret })
    };
  } catch (error) {
    console.error('Function error:', error.message, error.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Server error' })
    };
  }
};

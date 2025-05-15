const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const sgMail = require('@sendgrid/mail');
const fs = require('fs');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.handler = async (event) => {
  try {
    const { email } = JSON.parse(event.body);

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email is required' })
      };
    }

    // Debug: List files in the current directory
    console.log('Current directory:', __dirname);
    console.log('Files in current directory:', fs.readdirSync('.'));

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000,
      currency: 'usd',
      payment_method_types: ['card'],
      receipt_email: email
    });

    const msg = {
      to: email,
      from: 'tommynick979@gmail.com',
      subject: 'Your Sheet Music Purchase',
      text: 'Thank you for your purchase! Your sheet music is attached.',
      attachments: [
        {
          content: require('fs').readFileSync('sheet-music.pdf').toString('base64'),
          filename: 'sheet_music.pdf',
          type: 'application/pdf',
          disposition: 'attachment'
        }
      ]
    };

    await sgMail.send(msg);

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

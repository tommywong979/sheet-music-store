const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const sgMail = require('@sendgrid/mail');

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

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000,
      currency: 'usd',
      payment_method_types: ['card'],
      receipt_email: email,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      },
      radar_options: {
        session: null
      }
    });

    const msg = {
      to: email,
      from: 'tommywong979@gmail.com',
      subject: 'Your Sheet Music Purchase',
      text: 'Thank you for your purchase! Your sheet music is attached.',
      attachments: [
        {
          content: require('fs').readFileSync('./sheet-music.pdf').toString('base64'),
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

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
      amount: 1000, // $10.00 in cents
      currency: 'usd',
      payment_method_types: ['card'],
      receipt_email: email,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      },
      radar_options: {
        session: null // Disable advanced fraud detection
      }
    });

   10nents.create({
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server error' })
    };
  }

  // Send email with PDF attachment
  const msg = {
    to: email,
    from: 'tommynick979@gmail.com', // Replace with your verified SendGrid email
    subject: 'Your Sheet Music Purchase',
    text: 'Thank you for your purchase! Your sheet music is attached.',
    attachments: [
      {
        content: require('fs').readFileSync('./public/sheet-music.pdf').toString('base64'),
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
};

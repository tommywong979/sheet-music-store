const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');

exports.handler = async (event) => {
  try {
    const { amount, cartItems, name, country } = JSON.parse(event.body);

    // Create or retrieve a customer
    const customer = await stripe.customers.create({
      name: name,
      address: {
        country: country,
      },
      metadata: {
        cartItems: JSON.stringify(cartItems),
      },
    });

    // Create a PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Convert to cents
      currency: 'usd',
      customer: customer.id,
      payment_method_types: ['card'],
      confirmation_method: 'manual',
      description: `Sheet Music Purchase: ${cartItems.map(item => item.name).join(', ')}`,
      metadata: {
        name: name,
        country: country,
        cartItems: JSON.stringify(cartItems),
      },
    });

    // Send email with purchase confirmation
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: '"Tommy Wong\'s Sheet Music" <tommynick979@gmail.com>',
      to: customer.email || 'tommynick979@gmail.com', // Fallback to your email
      subject: 'Your Sheet Music Purchase Confirmation',
      html: `
        <table style="width: 100%; max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <tr>
            <td style="background-color: #f8f8f8; padding: 20px; text-align: center;">
              <h2>Tommy Wong's Sheet Music</h2>
              <p>Purchase Confirmation</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px;">
              <p>Dear ${name},</p>
              <p>Thank you for your purchase!</p>
              <p><strong>Items Purchased:</strong></p>
              <ul>
                ${cartItems.map(item => `<li>${item.name} - $${item.price.toFixed(2)}</li>`).join('')}
              </ul>
              <p><strong>Total:</strong> $${(amount).toFixed(2)}</p>
              <p><strong>Country:</strong> ${country}</p>
              <p><strong>Product Description:</strong> Sheet Music Delivery</p>
              <p>Your sheet music will be delivered via email soon.</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8f8f8; padding: 20px; text-align: center;">
              <p>&copy; 2025 Tommy Wong's Sheet Music</p>
            </td>
          </tr>
        </table>
      `,
      attachments: [
        {
          filename: 'sheet-music.pdf',
          path: './public/sheet-music.pdf', // Ensure this file exists in your Netlify public folder
        },
      ],
    };

    await transporter.sendMail(mailOptions);

    return {
      statusCode: 200,
      body: JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        customerId: customer.id,
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

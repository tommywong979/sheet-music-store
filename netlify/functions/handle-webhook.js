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

      // Fetch payment method details to get the card last 4 digits
      let cardLast4 = '4242'; // Default fallback
      try {
        const paymentMethod = await stripe.paymentMethods.retrieve(paymentIntent.payment_method);
        if (paymentMethod.card) {
          cardLast4 = paymentMethod.card.last4;
        }
      } catch (error) {
        console.error('Failed to fetch payment method details:', error.message);
      }

      // Download the PDF
      const pdfUrl = 'https://tommywongsheetmusic.netlify.app/sheet-music.pdf';
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

      // Prepare email details
      const amount = (paymentIntent.amount / 100).toFixed(2);
      const currency = paymentIntent.currency.toUpperCase();
      const paymentDate = new Date(paymentIntent.created * 1000).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });

      // Send the email with the PDF attachment
      const mailOptions = {
        from: `"Tommy Wong's Sheet Music" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'Your Sheet Music Purchase Confirmation',
        text: `Tommy Wong's Sheet Music charged you ${currency} ${amount} on ${paymentDate}. Your sheet music is attached.\n\nTransaction ID: ${paymentIntent.id}`,
        html: `
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <!-- Header -->
            <tr>
              <td align="center" style="padding: 20px;">
                <h1 style="color: #333333; font-size: 24px; margin: 0;">Tommy Wong's Sheet Music</h1>
                <p style="color: #333333; font-size: 16px; font-weight: bold; margin: 10px 0;">
                  Thank you for your purchase of ${currency} ${amount}
                </p>
                <p style="color: #666666; font-size: 14px; margin: 0;">
                  Purchased on ${paymentDate}
                </p>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td align="center" bgcolor="#f5f5f5" style="padding: 20px;">
                <p style="color: #333333; font-size: 16px; font-weight: bold; margin: 0 0 10px;">
                  Purchase Confirmation
                </p>
                <p style="color: #333333; font-size: 24px; font-weight: bold; margin: 0 0 10px;">
                  ${currency} ${amount}
                </p>
                <table width="100%" cellpadding="8" cellspacing="0" border="0" style="font-size: 14px; color: #666666;">
                  <tr>
                    <td width="40%">Product:</td>
                    <td>Sheet Music Delivery</td>
                  </tr>
                  <tr>
                    <td width="40%">Amount paid:</td>
                    <td>${currency} ${amount}</td>
                  </tr>
                  <tr>
                    <td width="40%">Date:</td>
                    <td>${paymentDate}</td>
                  </tr>
                  <tr>
                    <td width="40%">Payment method:</td>
                    <td>Card ending in ${cardLast4}</td>
                  </tr>
                  <tr>
                    <td width="40%">Transaction ID:</td>
                    <td>${paymentIntent.id}</td>
                  </tr>
                </table>
                <p style="color: #666666; font-size: 14px; margin-top: 20px;">
                  Your sheet music has been delivered as an attachment. Enjoy your music!
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding: 20px 0;">
                <hr style="border: 0; border-top: 1px solid #e0e0e0;" />
                <p style="text-align: center; color: #666666; font-size: 12px; margin: 10px 0;">
                  Powered by Tommy Wong's Sheet Music
                </p>
                <p style="text-align: center; color: #666666; font-size: 12px; margin: 0;">
                  <a href="https://tommywongsheetmusic.netlify.app/unsubscribe?email=${encodeURIComponent(email)}" 
                     style="color: #6772e5; text-decoration: none;">
                    Manage your email preferences
                  </a>
                </p>
              </td>
            </tr>
          </table>
        `,
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

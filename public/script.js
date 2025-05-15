document.addEventListener('DOMContentLoaded', () => {
  const stripe = Stripe('pk_test_your_publishable_key'); // Replace with your test publishable key
  const elements = stripe.elements();

  const cardElement = elements.create('card', {
    style: {
      base: {
        fontSize: '16px',
        color: '#32325d',
      }
    },
    hidePostalCode: true // Hides the postal code field
  });
  cardElement.mount('#card-element');

  const form = document.getElementById('payment-form');
  const messageDiv = document.getElementById('message');
  const cardErrors = document.getElementById('card-errors');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('email').value;
    messageDiv.textContent = 'Processing payment...';

    try {
      // Call the serverless function to create a Payment Intent
      const response = await fetch('/api/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const { clientSecret, error } = await response.json();

      if (error) {
        messageDiv.textContent = error;
        return;
      }

      // Confirm the payment with the clientSecret
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement
        }
      });

      if (result.error) {
        messageDiv.textContent = result.error.message;
      } else if (result.paymentIntent.status === 'succeeded') {
        messageDiv.textContent = 'Payment successful! Check your email for the sheet music.';
        form.reset();
      }
    } catch (err) {
      messageDiv.textContent = 'An error occurred. Please try again.';
    }
  });
});
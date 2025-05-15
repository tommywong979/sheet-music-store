import { loadStripe } from '@stripe/stripe-js/pure';

// Disable advanced fraud detection signals
loadStripe.setLoadParameters({ advancedFraudSignals: false });

const stripePromise = loadStripe('pk_live_YourLivePublishableKey'); // Replace with your live publishable key

const initializeStripe = async () => {
  const stripe = await stripePromise;
  const elements = stripe.elements();
  const cardElement = elements.create('card');
  cardElement.mount('#card-element');

  const form = document.getElementById('payment-form');
  const message = document.getElementById('message');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const emailInput = document.getElementById('email');
    const email = emailInput.value;

    message.textContent = 'Processing payment...';

    try {
      const response = await fetch('/.netlify/functions/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const { clientSecret } = await response.json();

      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement }
      });

      if (result.error) {
        message.textContent = result.error.message;
      } else if (result.paymentIntent.status === 'succeeded') {
        message.textContent = 'Payment successful! Check your email for the sheet music.';
      }
    } catch (error) {
      message.textContent = 'An error occurred. Please try again.';
    }
  });
};

initializeStripe();

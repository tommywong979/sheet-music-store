const stripe = Stripe('pk_test_51PvljW2LqWmcWOmS7OaJIGpMPvffxOaV3bC4r5X6SOfa5xR3Y2eO2EpBXIx1yD6hMKxOHYdxl6Yc1eA4M7gCrM3Z00kM3WvW5L');
const elements = stripe.elements();

let cartItems = JSON.parse(localStorage.getItem('cart')) || [];

// Add a sample cart item if cart is empty (for testing)
if (cartItems.length === 0) {
  cartItems = [
    {
      name: "Sample Sheet Music",
      price: 5.00
    }
  ];
  localStorage.setItem('cart', JSON.stringify(cartItems));
}

const cartElement = document.getElementById('cart-items');
const totalElement = document.getElementById('cart-total');
const paymentForm = document.getElementById('payment-form');
const cardErrors = document.getElementById('card-errors');

let total = 0;

// Initialize cart
function updateCart() {
  cartElement.innerHTML = '';
  total = 0;
  cartItems.forEach(item => {
    const li = document.createElement('li');
    li.textContent = `${item.name} - $${item.price.toFixed(2)}`;
    cartElement.appendChild(li);
    total += item.price;
  });
  totalElement.textContent = total.toFixed(2);
}

// Initialize Stripe Card Element
const cardElement = elements.create('card', {
  style: {
    base: {
      fontSize: '16px',
      color: '#32325d',
      '::placeholder': { color: '#aab7c4' },
    },
    invalid: { color: '#fa755a' },
  },
});
cardElement.mount('#card-element');

cardElement.on('change', (event) => {
  if (event.error) {
    cardErrors.textContent = event.error.message;
  } else {
    cardErrors.textContent = '';
  }
});

// Handle form submission
paymentForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Prevent submission if cart is empty
  if (total <= 0) {
    cardErrors.textContent = 'Your cart is empty. Please add items to proceed.';
    return;
  }

  const name = document.getElementById('name').value;
  const country = document.getElementById('country').value;

  try {
    // Create PaymentIntent
    const response = await fetch('/.netlify/functions/process-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: total,
        cartItems,
        name,
        country,
      }),
    });

    const { clientSecret, error } = await response.json();

    if (error) {
      cardErrors.textContent = error;
      return;
    }

    // Confirm card payment
    const result = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardElement,
        billing_details: {
          name: name,
          address: { country: country },
        },
      },
    });

    if (result.error) {
      cardErrors.textContent = result.error.message;
    } else if (result.paymentIntent.status === 'succeeded') {
      // Clear cart after successful payment
      localStorage.removeItem('cart');
      // Redirect to thank you page
      window.location.href = '/thank-you.html';
    }
  } catch (error) {
    cardErrors.textContent = 'An error occurred. Please try again.';
  }
});

// Initialize cart on page load
updateCart();

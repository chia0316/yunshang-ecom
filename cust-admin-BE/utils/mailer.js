const sgMail = require('@sendgrid/mail');

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const send = (mailOptions) => {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY not configured — skipping email send');
    return;
  }
  sgMail
    .send({
      // A display name here is what most inboxes actually show up front
      // (e.g. Gmail shows "Casa Yun", not the raw address) — the sender
      // address itself still has to be a real, domain-verified mailbox, so
      // it can't be hidden outright, only branded.
      from: { email: process.env.SENDGRID_FROM_EMAIL || 'no-reply@yunshang.com.sg', name: 'Casa Yun' },
      ...mailOptions
    })
    .catch((error) => {
      console.log(error.response?.body || error.message);
    });
};

const money = (value) => `$${Number(value).toFixed(2)}`;

// Shared receipt-style wrapper for every order-related email — a plain
// card with a dark brand header and a light footer carrying the company's
// real contact details (from Settings), so order emails read like an
// ecommerce receipt instead of a plain-text notice.
const emailLayout = (bodyHtml, company = {}) => `
  <div style="background:#f5f4f2;padding:32px 16px;font-family:Helvetica,Arial,sans-serif;color:#1c1917;">
    <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e7e5e4;">
      <tr>
        <td style="background:#1c1917;padding:24px 32px;text-align:center;">
          <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">CASA YUN</span>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;">
          ${bodyHtml}
        </td>
      </tr>
      <tr>
        <td style="background:#faf9f8;padding:20px 32px;text-align:center;font-size:12px;color:#78716c;border-top:1px solid #e7e5e4;">
          <p style="margin:0 0 4px;">${company.name || 'Casa Yun'}${company.address ? ` · ${company.address}` : ''}</p>
          <p style="margin:0;">${[company.phone && `Tel: ${company.phone}`, company.email].filter(Boolean).join(' · ')}</p>
        </td>
      </tr>
    </table>
  </div>
`;

const sendWelcomeMail = (email, firstName) => {
  send({
    to: email,
    subject: 'Welcome to Casa Yun',
    html: `<p>Hi ${firstName},</p><p>Your Casa Yun account has been created successfully. Happy shopping!</p>`
  });
};

// resetLink already has userId/token baked in as query params (see
// controllers/user.js forgetpassword) — the reset string itself is never a
// usable password, so the email must link to the reset form, not claim to
// be a "temporary password" you can log in with directly.
const sendPasswordResetMail = (email, resetLink) => {
  send({
    to: email,
    subject: 'Casa Yun password reset',
    html: `<p>We heard you lost your password.</p><p>Click the link below to choose a new one. This link expires in 1 hour.</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`
  });
};

const PAYMENT_METHODS = ['PayNow', 'NETS', 'Card', 'Cash'];
const CASH_PAYMENT_DAYS = 7;

// order.created_at, order.total_price, order.discount_amount are all
// present by the time this is called (order + delivery are created before
// the email is sent in routes/order.js).
const sendOrderConfirmationMail = (
  user,
  order,
  orderDetailsList,
  { paymentMethod, company = {}, delivery } = {}
) => {
  const orderRef = order.order_number || `#${order.id}`;
  const orderDate = new Date(order.created_at).toLocaleDateString('en-SG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const itemsSubtotal = orderDetailsList.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0
  );
  const discount = Number(order.discount_amount) || 0;
  const total = Number(order.total_price);
  // Derived, not recomputed — total = itemsSubtotal + shipping - discount,
  // so shipping falls out algebraically without duplicating the free-delivery
  // threshold logic that already lives in cust-FE's checkout.
  const shipping = Math.max(total - itemsSubtotal + discount, 0);

  const itemsRows = orderDetailsList
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f0efed;">
            <div style="font-weight:600;font-size:14px;">${item.name}</div>
            <div style="color:#78716c;font-size:13px;">Qty ${item.quantity}</div>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #f0efed;text-align:right;white-space:nowrap;font-size:14px;">
            ${money(Number(item.price) * item.quantity)}
          </td>
        </tr>
      `
    )
    .join('');

  // Only trust paymentMethod if it's one of the real enum values — it's
  // unvalidated client input and goes straight into the email body below.
  const safeMethod = PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : undefined;

  let paymentHtml = '';
  if (safeMethod === 'Cash' && company.address) {
    const dueDate = new Date(order.created_at);
    dueDate.setDate(dueDate.getDate() + CASH_PAYMENT_DAYS);
    paymentHtml = `
      <div style="margin-top:24px;padding:16px;background:#fdf2e9;border-radius:8px;">
        <p style="margin:0 0 4px;font-weight:600;font-size:14px;">Cash payment</p>
        <p style="margin:0;font-size:14px;">Please pay in cash at our office within ${CASH_PAYMENT_DAYS} days (by ${dueDate.toDateString()}) to confirm your order.</p>
        <p style="margin:8px 0 0;font-size:14px;">${company.address}${company.phone ? `<br>Phone: ${company.phone}` : ''}</p>
      </div>
    `;
  } else if (safeMethod === 'PayNow') {
    // No gateway yet — customer scans the QR shown on the confirmation page
    // and an admin manually marks the payment received.
    paymentHtml = `
      <div style="margin-top:24px;padding:16px;background:#fdf2e9;border-radius:8px;">
        <p style="margin:0 0 4px;font-weight:600;font-size:14px;">PayNow</p>
        <p style="margin:0;font-size:14px;">Please complete payment using the PayNow QR code shown on your order confirmation page. We'll confirm your order once payment is received.</p>
      </div>
    `;
  }

  const deliveryHtml = delivery
    ? `
      <div style="margin-top:24px;">
        <p style="margin:0 0 6px;font-weight:600;font-size:14px;">Delivery address</p>
        <p style="margin:0;font-size:14px;color:#44403c;line-height:1.5;">
          ${delivery.firstName} ${delivery.lastName}<br>
          ${delivery.address}${delivery.postal ? `, Singapore ${delivery.postal}` : ''}<br>
          ${delivery.contact}
        </p>
      </div>
    `
    : '';

  const bodyHtml = `
    <h1 style="margin:0 0 4px;font-size:20px;">Thank you for your order, ${user.firstName}!</h1>
    <p style="margin:0 0 24px;color:#78716c;font-size:14px;">Order ${orderRef} · ${orderDate}</p>
    <table role="presentation" width="100%" style="border-collapse:collapse;">
      ${itemsRows}
    </table>
    <table role="presentation" width="100%" style="margin-top:16px;font-size:14px;">
      <tr>
        <td style="padding:2px 0;color:#78716c;">Subtotal</td>
        <td style="padding:2px 0;text-align:right;">${money(itemsSubtotal)}</td>
      </tr>
      ${
        discount > 0
          ? `<tr>
               <td style="padding:2px 0;color:#78716c;">Discount</td>
               <td style="padding:2px 0;text-align:right;color:#b45309;">-${money(discount)}</td>
             </tr>`
          : ''
      }
      <tr>
        <td style="padding:2px 0;color:#78716c;">Shipping</td>
        <td style="padding:2px 0;text-align:right;">${shipping === 0 ? 'Free' : money(shipping)}</td>
      </tr>
      <tr>
        <td style="padding:10px 0 0;font-weight:700;border-top:1px solid #e7e5e4;">Total</td>
        <td style="padding:10px 0 0;text-align:right;font-weight:700;border-top:1px solid #e7e5e4;">${money(total)}</td>
      </tr>
    </table>
    ${paymentHtml}
    ${deliveryHtml}
  `;

  send({
    to: user.email,
    subject: `Casa Yun order confirmation ${orderRef}`,
    html: emailLayout(bodyHtml, company)
  });
};

const sendOrderStatusUpdateMail = (user, order, company = {}) => {
  const orderRef = order.order_number || `#${order.id}`;
  const bodyHtml = `
    <h1 style="margin:0 0 4px;font-size:20px;">Your order status has been updated</h1>
    <p style="margin:0 0 20px;color:#78716c;font-size:14px;">Order ${orderRef}</p>
    <div style="padding:16px;background:#faf9f8;border-radius:8px;">
      <p style="margin:0;font-size:14px;">
        Status: <strong style="text-transform:capitalize;">${order.status}</strong>
      </p>
    </div>
  `;
  send({
    to: user.email,
    subject: `Casa Yun order ${orderRef} update`,
    html: emailLayout(bodyHtml, company)
  });
};

// Sent whenever admin sets a delivery date on the order (routes/order.js
// PATCH /:oid/delivery) — a genuine "your delivery is scheduled" notice,
// distinct from the general order-status update email above.
const sendDeliveryScheduledMail = (user, order, delivery, company = {}) => {
  const orderRef = order.order_number || `#${order.id}`;
  const dateStr = delivery.delivery_date
    ? new Date(delivery.delivery_date).toLocaleDateString('en-SG', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : 'To be confirmed';

  const bodyHtml = `
    <h1 style="margin:0 0 4px;font-size:20px;">Your delivery has been scheduled</h1>
    <p style="margin:0 0 20px;color:#78716c;font-size:14px;">Order ${orderRef}</p>
    <div style="padding:16px;background:#faf9f8;border-radius:8px;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-weight:600;font-size:14px;">${dateStr}</p>
      ${delivery.delivery_slot ? `<p style="margin:0;font-size:14px;color:#44403c;">${delivery.delivery_slot}</p>` : ''}
    </div>
    <p style="margin:0 0 6px;font-weight:600;font-size:14px;">Delivering to</p>
    <p style="margin:0${delivery.remarks ? ' 0 20px' : ''};font-size:14px;color:#44403c;line-height:1.5;">
      ${delivery.first_name} ${delivery.last_name}<br>
      ${delivery.delivery_address}${delivery.delivery_postal ? `, Singapore ${delivery.delivery_postal}` : ''}<br>
      ${delivery.contact}
    </p>
    ${delivery.remarks ? `<p style="margin:0;font-size:13px;color:#78716c;">Note: ${delivery.remarks}</p>` : ''}
  `;

  send({
    to: user.email,
    subject: `Casa Yun order ${orderRef} — delivery scheduled`,
    html: emailLayout(bodyHtml, company)
  });
};

const ENQUIRY_TYPE_LABELS = {
  appointment: 'Appointment Booking',
  enquiry: 'Enquiry',
  other: 'Other'
};

const sendEnquiryNotificationMail = (enquiry) => {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;
  send({
    to: adminEmail,
    subject: `New ${ENQUIRY_TYPE_LABELS[enquiry.type] || 'enquiry'} from ${enquiry.name}`,
    html: `
      <p>New submission from the website contact form:</p>
      <ul>
        <li><b>Type:</b> ${ENQUIRY_TYPE_LABELS[enquiry.type] || enquiry.type}</li>
        <li><b>Name:</b> ${enquiry.name}</li>
        <li><b>Email:</b> ${enquiry.email}</li>
        ${enquiry.mobile ? `<li><b>Mobile:</b> ${enquiry.mobile}</li>` : ''}
        ${enquiry.preferred_date ? `<li><b>Preferred date:</b> ${enquiry.preferred_date}</li>` : ''}
        ${enquiry.preferred_time ? `<li><b>Preferred time:</b> ${enquiry.preferred_time}</li>` : ''}
        ${enquiry.type === 'appointment' ? `<li><b>Sales person requested:</b> ${enquiry.requires_sales_person ? 'Yes (subject to availability)' : 'No'}</li>` : ''}
      </ul>
      ${enquiry.message ? `<p><b>Message:</b> ${enquiry.message}</p>` : ''}
    `
  });
};

const sendEnquiryConfirmationMail = (enquiry) => {
  send({
    to: enquiry.email,
    subject: 'We received your request — Casa Yun',
    html: `<p>Hi ${enquiry.name},</p><p>Thanks for reaching out to Casa Yun. We've received your ${
      ENQUIRY_TYPE_LABELS[enquiry.type]?.toLowerCase() || 'request'
    } and will get back to you shortly.</p>`
  });
};

module.exports = {
  sendWelcomeMail,
  sendPasswordResetMail,
  sendOrderConfirmationMail,
  sendOrderStatusUpdateMail,
  sendDeliveryScheduledMail,
  sendEnquiryNotificationMail,
  sendEnquiryConfirmationMail
};

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
      from: process.env.SENDGRID_FROM_EMAIL || 'no-reply@yunshang.com.sg',
      ...mailOptions
    })
    .catch((error) => {
      console.log(error.response?.body || error.message);
    });
};

const sendWelcomeMail = (email, firstName) => {
  send({
    to: email,
    subject: 'Welcome to Casa Yun',
    html: `<p>Hi ${firstName},</p><p>Your Casa Yun account has been created successfully. Happy shopping!</p>`
  });
};

const sendTempPasswordMail = (email, tempPassword) => {
  send({
    to: email,
    subject: 'Casa Yun password reset',
    html: `<p>We heard you lost your password.</p><p>We've generated a temporary password for you: <b>${tempPassword}</b></p><p>Please log in and change it as soon as possible.</p>`
  });
};

const PAYMENT_METHODS = ['PayNow', 'NETS', 'Card', 'Cash'];
const CASH_PAYMENT_DAYS = 7;

const sendOrderConfirmationMail = (user, order, orderDetailsList, { paymentMethod, company } = {}) => {
  const itemsHtml = orderDetailsList
    .map(
      (item) =>
        `<li>${item.name} x ${item.quantity} — $${Number(item.price).toFixed(2)}</li>`
    )
    .join('');

  // Only trust paymentMethod if it's one of the real enum values — it's
  // unvalidated client input and goes straight into the email body below.
  const safeMethod = PAYMENT_METHODS.includes(paymentMethod) ? paymentMethod : undefined;

  let cashHtml = '';
  if (safeMethod === 'Cash' && company) {
    const dueDate = new Date(order.created_at);
    dueDate.setDate(dueDate.getDate() + CASH_PAYMENT_DAYS);
    cashHtml = `
      <p><b>Cash payment instructions:</b> Please pay in cash at our office within
      ${CASH_PAYMENT_DAYS} days (by ${dueDate.toDateString()}) to confirm your order.</p>
      <ul>
        <li>Address: ${company.address}</li>
        ${company.phone ? `<li>Phone: ${company.phone}</li>` : ''}
      </ul>
    `;
  }

  send({
    to: user.email,
    subject: `Casa Yun order confirmation #${order.id}`,
    html: `<p>Hi ${user.firstName},</p><p>Thank you for your order #${order.id}. Total: $${Number(order.total_price).toFixed(2)}.</p><ul>${itemsHtml}</ul>${cashHtml}`
  });
};

const sendOrderStatusUpdateMail = (user, order) => {
  send({
    to: user.email,
    subject: `Casa Yun order #${order.id} update`,
    html: `<p>Hi ${user.firstName},</p><p>Your order #${order.id} status has been updated to <b>${order.status}</b>.</p>`
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
  sendTempPasswordMail,
  sendOrderConfirmationMail,
  sendOrderStatusUpdateMail,
  sendEnquiryNotificationMail,
  sendEnquiryConfirmationMail
};

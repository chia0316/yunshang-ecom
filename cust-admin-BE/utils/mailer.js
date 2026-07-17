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

const sendOrderConfirmationMail = (user, order, orderDetailsList) => {
  const itemsHtml = orderDetailsList
    .map(
      (item) =>
        `<li>${item.name} x ${item.quantity} — $${Number(item.price).toFixed(2)}</li>`
    )
    .join('');
  send({
    to: user.email,
    subject: `Casa Yun order confirmation #${order.id}`,
    html: `<p>Hi ${user.firstName},</p><p>Thank you for your order #${order.id}. Total: $${Number(order.total_price).toFixed(2)}.</p><ul>${itemsHtml}</ul>`
  });
};

const sendOrderStatusUpdateMail = (user, order) => {
  send({
    to: user.email,
    subject: `Casa Yun order #${order.id} update`,
    html: `<p>Hi ${user.firstName},</p><p>Your order #${order.id} status has been updated to <b>${order.status}</b>.</p>`
  });
};

module.exports = {
  sendWelcomeMail,
  sendTempPasswordMail,
  sendOrderConfirmationMail,
  sendOrderStatusUpdateMail
};

const axios = require('axios');
const jwt = require('jsonwebtoken');

const secretKey = process.env.JWT_SECRET_KEY;
if (!secretKey) {
  throw new Error('JWT_SECRET_KEY environment variable is required');
}
const captchaKey = process.env.CAPTCHA_KEY;

const authenticate = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    const token = auth !== undefined ? auth.split(' ')[1] : undefined;
    if (!auth || auth.split(' ')[0] !== 'Bearer' || !token) {
      return res
        .status(401)
        .send({ error: 'Unauthorized request for this endpoint' });
    }
    const decodedToken = jwt.verify(token, secretKey);
    req.userId = decodedToken.userId;
    req.username = decodedToken.username;
    req.isAdmin = decodedToken.isAdmin;
    return next();
  } catch (err) {
    return res.status(401).send({ error: 'Error parsing auth token' });
  }
};

// Decodes the Bearer token if present, but never rejects the request —
// used on public storefront routes that show extra data (e.g. inactive
// products) to admins without requiring a separate admin-only endpoint.
const attachAdminFlag = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    const token = auth !== undefined ? auth.split(' ')[1] : undefined;
    if (token) {
      const decodedToken = jwt.verify(token, secretKey);
      req.isAdmin = decodedToken.isAdmin;
    }
  } catch (err) {
    // ignore invalid/expired tokens on public routes
  }
  return next();
};

const verifyCaptcha = async (req, res, next) => {
  if (!captchaKey) {
    console.warn('CAPTCHA_KEY not configured — skipping captcha verification');
    return next();
  }
  const token = req.params.token;
  try {
    const url = `https://www.google.com/recaptcha/api/siteverify?secret=${captchaKey}&response=${token}`;
    const resp = await axios.post(url);
    if (resp.data.success) {
      return next();
    }
    return res.status(422).send({ error: 'Error while verifying captcha' });
  } catch (err) {
    return res.status(500).send({ error: 'Error while verifying captcha' });
  }
};

module.exports = { authenticate, attachAdminFlag, verifyCaptcha };

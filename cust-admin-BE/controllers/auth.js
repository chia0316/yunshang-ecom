const jwt = require('jsonwebtoken');
const secretKey = process.env.JWT_SECRET_KEY;

const verifyAuth = (req, res) => {
  try {
    const auth = req.headers.authorization;
    const token = auth !== undefined ? auth.split(' ')[1] : undefined;
    if (!auth || auth.split(' ')[0] !== 'Bearer' || !token) {
      return res
        .status(200)
        .send({ authenticated: false, error: 'Auth token not found' });
    }
    const decodedToken = jwt.verify(token, secretKey);
    if (!decodedToken) {
      return res.status(200).send({ authenticated: false });
    }
    return res.status(200).send({ authenticated: true });
  } catch (error) {
    return res
      .status(200)
      .send({ error: 'Error parsing auth token', authenticated: false });
  }
};

module.exports = {
  verifyAuth
};

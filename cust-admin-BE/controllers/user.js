const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { body } = require('express-validator');
const { Op, ValidationError } = require('sequelize');

const User = require('../productModels/User.model');
const DeletedRecord = require('../productModels/DeletedRecord.model');
const PasswordReset = require('../productModels/PasswordReset.model');
const Wishlist = require('../productModels/Wishlist.model');
const Product = require('../productModels/Product.model');
const validate = require('../utils/validator');
const mailer = require('../utils/mailer');

const validPasswordRegex =
  /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;

const bodyValidations = {
  username: body('username')
    .trim()
    .notEmpty()
    .isLength({ min: 5 })
    .withMessage('Username must be at least 5 characters long'),
  password: body('password')
    .trim()
    .notEmpty()
    .matches(validPasswordRegex)
    .withMessage(
      'Password must be minimum eight characters, at least one letter, one number and one special character'
    ),
  firstName: body('firstName')
    .notEmpty()
    .withMessage('First name cannot be empty'),
  lastName: body('lastName').notEmpty().withMessage('Last name cannot be empty'),
  email: body('email').notEmpty().isEmail().withMessage('Invalid email'),
  mobile: body('mobile').optional({ nullable: true }),
  deliveryAddress: body('deliveryAddress').optional({ nullable: true }),
  deliveryPostal: body('deliveryPostal').optional({ nullable: true })
};

const userData = async (req, res) => {
  try {
    const userId = req.params.id || req.userId;
    if (!userId) {
      return res.status(401).send({ error: 'Unauthorized request' });
    }
    const user = await User.findByPk(userId, {
      raw: true,
      attributes: { exclude: ['password'] }
    });
    if (!user) {
      return res.status(404).send({ error: 'User account not found' });
    }
    return res.status(200).send({ data: user });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const signup = async (req, res) => {
  try {
    const isValid = await validate.run(
      req,
      res,
      Object.values(bodyValidations)
    );
    if (!isValid) {
      return;
    }
    const data = req.body;

    const [usernameTaken, emailTaken] = await Promise.all([
      User.findOne({ where: { username: data.username } }),
      User.findOne({ where: { email: data.email } })
    ]);
    if (usernameTaken && emailTaken) {
      return res.status(422).send({
        error: 'This username and email are both already registered',
        fields: ['username', 'email']
      });
    }
    if (usernameTaken) {
      return res
        .status(422)
        .send({ error: 'This username is already taken', fields: ['username'] });
    }
    if (emailTaken) {
      return res
        .status(422)
        .send({ error: 'This email is already registered', fields: ['email'] });
    }

    const hashPassword = await bcrypt.hash(data.password, 12);
    const newUser = await User.create({
      username: data.username,
      password: hashPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      mobile: data.mobile || null,
      isAdmin: false,
      status: 'Active',
      deliveryAddress: data.deliveryAddress || null,
      deliveryPostal: data.deliveryPostal || null,
      lastLoginAt: new Date()
    });

    res
      .status(200)
      .send({ message: 'Account created successfully!', pk: newUser.id });

    mailer.sendWelcomeMail(data.email, data.firstName);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(422).send({ error: err.errors[0].message });
    }
    return res.status(500).send({ error: err.message });
  }
};

const login = async (req, res) => {
  try {
    const isValid = await validate.run(req, res, [
      body('username').trim().exists().notEmpty().withMessage('Username cannot be empty'),
      body('password').trim().exists().notEmpty().withMessage('Password cannot be empty')
    ]);
    if (!isValid) {
      return;
    }
    // The "username" field doubles as an email login — customers often
    // forget which one they signed up with.
    const { username, password } = req.body;
    const userExists = await User.findOne({
      where: { [Op.or]: [{ username }, { email: username }] }
    });
    if (!userExists) {
      return res.status(404).send({ error: 'Username or password incorrect' });
    }
    if (userExists.status === 'Suspended') {
      return res.status(403).send({ error: 'Account is suspended' });
    }
    const passwordMatched = await bcrypt.compare(password, userExists.password);
    if (!passwordMatched) {
      return res.status(422).send({ error: 'Username or password incorrect' });
    }

    const token = jwt.sign(
      {
        userId: userExists.id,
        username: userExists.username,
        isAdmin: userExists.isAdmin
      },
      process.env.JWT_SECRET_KEY,
      { expiresIn: '2h' }
    );

    const usersWishlist = await Wishlist.findAll({
      where: { user_id: userExists.id },
      include: [{ model: Product, required: true }]
    });

    await User.update(
      { lastLoginAt: new Date() },
      { where: { id: userExists.id } }
    );

    return res.status(200).send({
      message: 'Login successful',
      userId: userExists.id,
      username: userExists.username,
      firstName: userExists.firstName,
      token,
      isAdmin: userExists.isAdmin,
      wishlist: usersWishlist.map((item) => item.product)
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const forgetpassword = async (req, res) => {
  try {
    const isValid = await validate.run(req, res, [
      body('email').trim().exists().notEmpty().withMessage('Email cannot be empty')
    ]);
    if (!isValid) {
      return;
    }
    const { email } = req.body;
    const userExists = await User.findOne({ where: { email } });
    if (!userExists) {
      return res.status(404).send({ error: 'Email not found' });
    }

    await PasswordReset.destroy({ where: { user_id: userExists.id } });

    const resetString = crypto.randomBytes(32).toString('hex');
    const hashedResetString = await bcrypt.hash(resetString, 10);
    const expiryAt = new Date(Date.now() + 60 * 60 * 1000);

    await PasswordReset.create({
      user_id: userExists.id,
      reset_string: hashedResetString,
      expiry_at: expiryAt
    });

    mailer.sendTempPasswordMail(userExists.email, resetString);

    return res.status(200).send({
      message: 'Password reset instructions sent to your email'
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const resetpassword = async (req, res) => {
  try {
    const isValid = await validate.run(req, res, [
      body('userId').exists().notEmpty().withMessage('userId cannot be empty'),
      body('resetString').exists().notEmpty().withMessage('resetString cannot be empty'),
      body('newPassword')
        .trim()
        .exists()
        .notEmpty()
        .matches(validPasswordRegex)
        .withMessage(
          'New password must be minimum eight characters, at least one letter, one number and one special character'
        )
    ]);
    if (!isValid) {
      return;
    }
    const { userId, resetString, newPassword } = req.body;
    const resetRecord = await PasswordReset.findOne({
      where: { user_id: userId }
    });
    if (!resetRecord) {
      return res.status(404).send({ error: 'Reset request not found' });
    }
    if (resetRecord.expiry_at < new Date()) {
      await resetRecord.destroy();
      return res.status(410).send({ error: 'Reset link has expired' });
    }
    const matched = await bcrypt.compare(resetString, resetRecord.reset_string);
    if (!matched) {
      return res.status(422).send({ error: 'Invalid reset link' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    await User.update(
      { password: hashedNewPassword },
      { where: { id: userId } }
    );
    await resetRecord.destroy();

    return res.status(200).send({ message: 'Password reset successfully' });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const update = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).send({ error: 'Unauthorized request' });
    }
    const data = req.body;
    if (Object.keys(data).length === 0) {
      return res.status(200).send({ message: 'Account updated successfully' });
    }
    const validations = Object.keys(data)
      .filter((key) => bodyValidations[key])
      .map((key) => bodyValidations[key]);
    const isValid = await validate.run(req, res, validations);
    if (!isValid) {
      return;
    }
    const userExists = await User.findByPk(userId);
    if (!userExists) {
      return res.status(404).send({ error: 'Account not found' });
    }
    const { username, password, isAdmin, status, ...allowedUpdates } = data;
    await User.update(allowedUpdates, { where: { id: userId } });
    return res.status(200).send({ message: 'Account updated successfully' });
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(422).send({ error: err.errors[0].message });
    }
    return res.status(500).send({ error: err.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).send({ error: 'Unauthorized request' });
    }
    const userExists = await User.findByPk(userId, { raw: true });
    if (!userExists) {
      return res.status(404).send({ error: 'User account not found' });
    }
    await DeletedRecord.create({
      original_user_id: userExists.id,
      username: userExists.username,
      email: userExists.email,
      firstName: userExists.firstName,
      lastName: userExists.lastName,
      mobile: userExists.mobile
    });
    await User.destroy({ where: { id: userId } });
    return res.status(200).send({ message: 'Account deleted successfully' });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

const updatePassword = async (req, res) => {
  try {
    const isValid = await validate.run(req, res, [
      body('currentPassword').trim().exists().notEmpty(),
      body('newPassword')
        .trim()
        .exists()
        .notEmpty()
        .matches(validPasswordRegex)
        .withMessage(
          'New password must be minimum eight characters, at least one letter, one number and one special character'
        )
    ]);
    if (!isValid) {
      return;
    }
    const userId = req.userId;
    if (!userId) {
      return res.status(401).send({ error: 'Unauthorized request' });
    }
    const userExists = await User.findByPk(userId);
    if (!userExists) {
      return res.status(404).send({ error: 'User account not found' });
    }
    const { currentPassword, newPassword } = req.body;
    const passwordMatched = await bcrypt.compare(
      currentPassword,
      userExists.password
    );
    if (!passwordMatched) {
      return res.status(422).send({ error: 'Password incorrect' });
    }
    const hashPassword = await bcrypt.hash(newPassword, 12);
    await User.update({ password: hashPassword }, { where: { id: userId } });
    return res.status(200).send({ message: 'Password updated successfully' });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

module.exports = {
  signup,
  login,
  update,
  deleteUser,
  userData,
  forgetpassword,
  resetpassword,
  updatePassword
};

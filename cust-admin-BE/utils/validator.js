const { validationResult } = require('express-validator');

const run = async (req, res, validations) => {
  for (let validation of validations) {
    await validation.run(req);
  }
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return true;
  }
  const extractedErrors = [];
  console.log('Errors: ', errors);
  errors
    .array()
    .filter((error) => error.msg.toLowerCase() !== 'invalid value')
    .map((error) => extractedErrors.push(error.msg));

  res.status(422).send({
    errors: extractedErrors
  });
  return false;
};

module.exports = { run };

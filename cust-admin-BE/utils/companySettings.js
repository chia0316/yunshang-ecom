const getCompanySettings = () => ({
  name: process.env.COMPANY_NAME || 'Yun Shang Pte Ltd',
  address: process.env.COMPANY_ADDRESS || 'Singapore',
  phone: process.env.COMPANY_PHONE || '',
  email: process.env.COMPANY_EMAIL || '',
  uen: process.env.COMPANY_UEN || '',
  gst: {
    enabled: process.env.GST_ENABLED === 'true',
    rate: parseFloat(process.env.GST_RATE || '9')
  }
});

module.exports = { getCompanySettings };

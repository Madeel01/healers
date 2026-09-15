const express = require('express');
const router = express.Router();
const { 
  register, 
  login, 
  loginBiometric, 
  registerBiometric 
} = require('../controllers/authController');
const { protect, checkRole, checkPermission } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/login-biometric', loginBiometric);

router.post('/register-biometric', protect, registerBiometric);

// router.get('/profile', protect, (req, res) => {
//   res.json({ message: 'Protected Profile Data', user: req.user });
// });

// router.get('/admin-dashboard', protect, checkRole('Admin'), (req, res) => {
//   res.json({ message: 'Welcome Admin' });
// });

// router.get('/analytics', protect, checkPermission('read_analytics'), (req, res) => {
//   res.json({ message: 'Analytics Data Accessible' });
// });

module.exports = router;
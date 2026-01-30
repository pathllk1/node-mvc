const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/', (req, res) => {
  res.render('index', { title: 'Home Page', message: 'Welcome to the Node.js MVC Application!' });
});

// Include stocks routes
router.use('/stocks', require('./stocks'));

// Route for the log console
router.get('/console', (req, res) => {
  res.render('console', { title: 'Server Console' });
});

module.exports = router;
const User = require('../models/User');

// Get all users
exports.getAllUsers = (req, res) => {
    const users = User.getAll();
    res.render('users/index', { 
        title: 'All Users', 
        users: users 
    });
};

// Show create user form
exports.showCreateForm = (req, res) => {
    res.render('users/create', { 
        title: 'Create New User' 
    });
};

// Create a new user
exports.createUser = (req, res) => {
    const { name, email } = req.body;
    const userData = { name, email };
    User.create(userData);
    res.redirect('/users');
};

// Get user by ID
exports.getUserById = (req, res) => {
    const userId = parseInt(req.params.id);
    const user = User.getById(userId);
    
    if (!user) {
        return res.status(404).render('error/404', { title: 'User Not Found' });
    }
    
    res.render('users/show', { 
        title: user.name, 
        user 
    });
};

// Show edit user form
exports.showEditForm = (req, res) => {
    const userId = parseInt(req.params.id);
    const user = User.getById(userId);
    
    if (!user) {
        return res.status(404).render('error/404', { title: 'User Not Found' });
    }
    
    res.render('users/edit', { 
        title: `Edit ${user.name}`, 
        user 
    });
};

// Update user
exports.updateUser = (req, res) => {
    const userId = parseInt(req.params.id);
    
    const { name, email } = req.body;
    const userData = { name, email };
    
    const updatedUser = User.update(userId, userData);
    
    if (!updatedUser) {
        return res.status(404).render('error/404', { title: 'User Not Found' });
    }
    
    res.redirect(`/users/${userId}`);
};

// Delete user
exports.deleteUser = (req, res) => {
    const userId = parseInt(req.params.id);
    
    const deletedUser = User.delete(userId);
    
    if (!deletedUser) {
        return res.status(404).render('error/404', { title: 'User Not Found' });
    }
    
    res.redirect('/users');
};
// User Model - Simple in-memory data store for demonstration
// In a real application, this would connect to a database

class User {
  constructor(id, name, email) {
    this.id = id;
    this.name = name;
    this.email = email;
  }

  // Static method to get all users
  static getAll() {
    // In a real app, this would query a database
    return users;
  }

  // Static method to get a user by ID
  static getById(id) {
    return users.find(user => user.id == id);
  }

  // Static method to create a new user
  static create(userData) {
    const newUser = new User(
      users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
      userData.name,
      userData.email
    );
    users.push(newUser);
    return newUser;
  }

  // Static method to update a user
  static update(id, userData) {
    const userIndex = users.findIndex(u => u.id == id);
    if (userIndex !== -1) {
      users[userIndex].name = userData.name || users[userIndex].name;
      users[userIndex].email = userData.email || users[userIndex].email;
      return users[userIndex];
    }
    return null;
  }

  // Static method to delete a user
  static delete(id) {
    const userIndex = users.findIndex(u => u.id == id);
    if (userIndex !== -1) {
      return users.splice(userIndex, 1)[0];
    }
    return null;
  }
}

// Mock data array - in a real application this would be in a database
let users = [
  new User(1, 'John Doe', 'john@example.com'),
  new User(2, 'Jane Smith', 'jane@example.com'),
  new User(3, 'Bob Johnson', 'bob@example.com')
];

module.exports = User;
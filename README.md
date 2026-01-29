# Node.js MVC Application

A Node.js MVC application built with Express, EJS, and serverless-http for easy deployment to serverless platforms.

## Features

- **MVC Architecture**: Clean separation of concerns with Models, Views, and Controllers
- **EJS View Engine**: Using EJS with ejs-mate for layouts and partials
- **Serverless Ready**: Built with serverless-http for deployment to AWS Lambda or similar platforms
- **RESTful Routing**: Full CRUD operations for user management
- **Bootstrap UI**: Responsive design with Bootstrap

## Requirements

- Node.js v14 or higher
- npm

## Installation

1. Clone or download the repository
2. Install dependencies:

```bash
npm install
```

## Usage

### Local Development

```bash
npm run dev
```

Then visit `http://localhost:3000`

### Production Build

```bash
npm start
```

### Serverless Deployment

The application is configured for deployment with Serverless Framework:

1. Install Serverless Framework: `npm install -g serverless`
2. Configure your cloud provider credentials
3. Deploy: `serverless deploy`

## Project Structure

```
├── app.js                  # Main application file
├── middleware/
│   └── methodOverride.js   # HTTP method override middleware
├── controllers/
│   └── userController.js   # User management controller
├── models/                 # Data models
├── routes/
│   ├── index.js           # Home routes
│   └── users.js           # User management routes
├── views/
│   ├── layouts/
│   │   └── main.ejs       # Main layout template
│   ├── index.ejs          # Home page
│   ├── users/
│   │   ├── index.ejs      # Users list
│   │   ├── create.ejs     # Create user form
│   │   ├── show.ejs       # Show user details
│   │   └── edit.ejs       # Edit user form
│   └── error/
│       ├── 404.ejs        # Not found error page
│       └── error.ejs      # General error page
├── public/
│   ├── css/
│   │   └── style.css      # Custom styles
│   └── js/
│       └── main.js        # Client-side JavaScript
└── serverless.yml         # Serverless configuration
```

## API Endpoints

- `GET /` - Home page
- `GET /users` - List all users
- `GET /users/create` - Show create user form
- `POST /users` - Create a new user
- `GET /users/:id` - Show a specific user
- `GET /users/:id/edit` - Show edit user form
- `PUT /users/:id` - Update a user
- `DELETE /users/:id` - Delete a user

## License

MIT
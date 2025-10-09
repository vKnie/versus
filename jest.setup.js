// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock environment variables for tests
process.env.DB_HOST = 'localhost'
process.env.DB_USER = 'test'
process.env.DB_PASSWORD = 'test'
process.env.DB_NAME = 'test_db'
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.NEXTAUTH_URL = 'http://localhost:3000'

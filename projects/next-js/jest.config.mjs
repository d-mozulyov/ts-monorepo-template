/**
 * Jest configuration for Next.js project.
 * This configuration sets up Jest to work with TypeScript and Next.js environment.
 * For more details, refer to: https://jestjs.io/docs/configuration
 */
import nextJest from 'next/jest.js';

// Providing the path to your Next.js app which will enable loading next.config.js and .env files
const createJestConfig = nextJest({ dir: './' })

// Any custom config you want to pass to Jest
const customJestConfig = {
    // Specifies the test environment to simulate a browser-like environment using jsdom
    testEnvironment: 'jsdom',
    // Defines module name mapper for aliasing imports (useful for Next.js paths)
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    // Indicates which provider should be used to instrument code for coverage
    coverageProvider: 'v8',
    // Collects coverage from specific files
    collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
}

// createJestConfig is exported in this way to ensure that next/jest can load the Next.js configuration, which is async
export default createJestConfig(customJestConfig)
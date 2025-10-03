// Suppress console errors/warnings during tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};

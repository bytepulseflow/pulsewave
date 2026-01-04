import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock mediasoup-client
vi.mock('mediasoup-client', () => ({
  Device: vi.fn().mockImplementation(() => ({
    load: vi.fn(),
    createSendTransport: vi.fn(),
    createRecvTransport: vi.fn(),
    canProduce: vi.fn(() => true),
    getRtpCapabilities: vi.fn(() => ({})),
  })),
  types: {
    Transport: {},
    Producer: {},
    Consumer: {},
    DataProducer: {},
    DataConsumer: {},
  },
}));

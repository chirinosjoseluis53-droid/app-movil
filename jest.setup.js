// Silencia los avisos deprecation de expo-sqlite durante las pruebas.
jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(async () => ({
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async () => null),
    runAsync: jest.fn(async () => undefined),
    execAsync: jest.fn(async () => undefined),
  })),
  SQLiteProvider: ({ children }) => children,
}));

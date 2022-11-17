import integrationTests from './api/index.spec';
import unitTests from './models.spec';

describe('Report', () => {
  describe('Models', unitTests);
  describe('API', integrationTests);
});

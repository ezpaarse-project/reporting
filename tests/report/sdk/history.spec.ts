import chai from 'chai';
import { history } from 'reporting-sdk-js';

const { expect } = chai;

const entrySchema = {
  type: 'object',
  required: ['id', 'taskId', 'type', 'message', 'createdAt'],
  properties: {
    id: {
      type: 'string',
    },
    taskId: {
      type: 'string',
    },
    message: {
      type: 'string',
    },
    data: {
      type: ['object', 'null', 'undefined'],
    },
    createdAt: {
      type: 'object',
      format: 'date-time',
    },
  },
};

export default () => {
  describe('getAllEntries()', () => {
    let res: ReturnType<typeof history.getAllEntries> | undefined;

    it('should return history entries', async () => {
      if (!res) {
        res = history.getAllEntries();
      }
      const { content } = await res;

      // eslint-disable-next-line no-restricted-syntax
      for (const entry of content) {
        expect(entry).to.be.jsonSchema(entrySchema);
      }
    });
  });
};

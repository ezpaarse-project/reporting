import chai from 'chai';
import chaiHttp from 'chai-http';
import chaiLike from 'chai-like';
import { randomBytes } from 'crypto';
import type { createTask } from 'reporting-report/models/tasks';
import config from '../../lib/config';

const { expect } = chai;

chai.use(chaiHttp);
chai.use(chaiLike);

const request = chai.request(config.REPORT_API);

type Task = Awaited<ReturnType<typeof createTask>>;

export default () => {
  describe('General', () => {
    describe('GET /ping', () => {
      it('should return 204', (done) => {
        request.get('/ping').end((_err, res) => {
          expect(res).to.have.status(204);
          done();
        });
      });
    });

    describe('"GET /:random"', () => {
      it('should return 404', (done) => {
        const url = `/${randomBytes(20).toString('base64')}`;
        request.get(url).end((_err, res) => {
          expect(res).to.have.status(404);
          done();
        });
      });
    });
  });

  describe('Tasks', () => {
    let task: Task = {
      layout: {},
      targets: ['fake@inist.fr'],
      recurrence: 'WEEKLY',
      nextRun: new Date(2022, 11, 25),
      enabled: false,
    } as Task;

    describe('POST /tasks', () => {
      it('should return complete task', (done) => {
        request.post('/tasks')
          .auth(config.EZMESURE_TOKEN, { type: 'bearer' })
          .type('json').send(task)
          .end((err, res) => {
            if (err) done(err);

            expect(res).to.have.status(201);
            expect(res.body).to.like({
              status: { code: 201, message: 'Created' },
              content: { ...task, nextRun: task.nextRun?.toISOString() },
            });
            task = res.body.content;
            done();
          });
      });
    });

    describe('GET /tasks', () => {
      it('should include task', (done) => {
        request.get('/tasks')
          .auth(config.EZMESURE_TOKEN, { type: 'bearer' })
          .end((err, res) => {
            if (err) done(err);

            expect(res).to.have.status(200);
            expect(res.body.status).to.like({ code: 200, message: 'OK' });
            expect(res.body.content).to.be.an('array');
            const t = res.body.content.find(({ id }: Task) => id === task.id);
            expect(t).to.like(task);
            done();
          });
      });
    });

    describe('GET /tasks/:taskId', () => {
      it('should include task', (done) => {
        request.get(`/tasks/${task.id}`)
          .auth(config.EZMESURE_TOKEN, { type: 'bearer' })
          .end((err, res) => {
            if (err) done(err);

            expect(res).to.have.status(200);
            expect(res.body).to.like({
              status: { code: 200, message: 'OK' },
              content: task,
            });
            done();
          });
      });
    });

    describe('PUT /tasks/:taskId', () => {
      it('should return complete task', (done) => {
        const { id } = task;
        task = {
          layout: {},
          targets: ['fake@inist.fr', 'fake2@inist.fr'],
          recurrence: 'WEEKLY',
          nextRun: new Date(2022, 10, 25),
          enabled: false,
        } as Task;

        request.put(`/tasks/${id}`)
          .auth(config.EZMESURE_TOKEN, { type: 'bearer' })
          .type('json').send(task)
          .end((err, res) => {
            if (err) done(err);

            expect(res).to.have.status(200);
            expect(res.body).to.like({
              status: { code: 200, message: 'OK' },
              content: { ...task, nextRun: task.nextRun?.toISOString() },
            });
            task = res.body.content;
            done();
          });
      });
    });

    describe('DELETE /tasks/:taskId', () => {
      it('should include task', (done) => {
        request.delete(`/tasks/${task.id}`)
          .auth(config.EZMESURE_TOKEN, { type: 'bearer' })
          .end((err, res) => {
            if (err) done(err);

            expect(res).to.have.status(200);
            expect(res.body).to.like({
              status: { code: 200, message: 'OK' },
              content: task,
            });
            done();
          });
      });
    });
  });
};

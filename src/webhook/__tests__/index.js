jest.mock('src/webhook/checkSignatureAndParse');
jest.mock('src/webhook/lineClient');
jest.mock('src/lib/redisClient');

import Koa from 'koa';
import request from 'supertest';
import MockDate from 'mockdate';

import webhookRouter from '../';
import UserSettings from '../../database/models/userSettings';
import Client from '../../database/mongoClient';
import lineClient from 'src/webhook/lineClient';
import redis from 'src/lib/redisClient';

const sleep = async ms => new Promise(resolve => setTimeout(resolve, ms));

describe('Webhook router', () => {
  beforeEach(() => {
    redis.set.mockClear();
    lineClient.mockClear();
  });

  beforeAll(async () => {
    MockDate.set(612921600000);

    if (await UserSettings.collectionExists()) {
      await (await UserSettings.client).drop();
    }
  });

  afterAll(async () => {
    await (await Client.getInstance()).close();
    MockDate.reset();
  });

  it('singleUserHandler() should handle follow event', async () => {
    const userId = 'U4af4980629';
    const app = new Koa();
    app.use(webhookRouter.routes(), webhookRouter.allowedMethods());

    const eventObject = {
      events: [
        {
          replyToken: 'nHuyWiB7yP5Zw52FIkcQobQuGDXCTA',
          type: 'follow',
          mode: 'active',
          timestamp: 1462629479859,
          source: {
            type: 'user',
            userId,
          },
        },
      ],
    };

    const server = app.listen();

    await request(server)
      .post('/')
      .send(eventObject)
      .expect(200);

    /**
     * The HTTP response isn't guaranteed the event handling to be complete
     */
    await sleep(500);

    expect(
      (await UserSettings.find({ userId })).map(e => ({ ...e, _id: '_id' }))
    ).toMatchSnapshot();

    return new Promise((resolve, reject) => {
      server.close(error => {
        if (error) return reject(error);
        resolve();
      });
    });
  });

  it('singleUserHandler() should handle follow then unfollow then follow event', async () => {
    const userId = 'U4af4980630';
    const app = new Koa();
    app.use(webhookRouter.routes(), webhookRouter.allowedMethods());

    const eventObject = {
      events: [
        {
          replyToken: 'nHuyWiB7yP5Zw52FIkcQobQuGDXCTA',
          type: undefined,
          mode: 'active',
          timestamp: 1462629479859,
          source: {
            type: 'user',
            userId,
          },
        },
      ],
    };

    const types = ['follow', 'unfollow', 'follow'];

    const server = app.listen();

    for (const type of types) {
      eventObject.events[0].type = type;
      await request(server)
        .post('/')
        .send(eventObject)
        .expect(200);

      /**
       * The HTTP response isn't guaranteed the event handling to be complete
       */
      await sleep(500);
      expect(
        (await UserSettings.find({ userId })).map(e => ({ ...e, _id: '_id' }))
      ).toMatchSnapshot();
    }

    return new Promise((resolve, reject) => {
      server.close(error => {
        if (error) return reject(error);
        resolve();
      });
    });
  });

  it('singleUserHandler() should reply default messages', async () => {
    const userId = 'U4af4980630';
    const app = new Koa();
    app.use(webhookRouter.routes(), webhookRouter.allowedMethods());

    const eventObject = {
      events: [
        {
          replyToken: 'nHuyWiB7yP5Zw52FIkcQobQuGDXCTA',
          type: 'messages',
          mode: 'active',
          timestamp: 1462629479859,
          source: {
            type: 'user',
            userId,
          },
          message: {
            id: '325708',
            type: 'sticker',
            packageId: '1',
            stickerId: '1',
            stickerResourceType: 'STATIC',
          },
        },
      ],
    };

    const server = app.listen();

    await request(server)
      .post('/')
      .send(eventObject)
      .expect(200);

    /**
     * The HTTP response isn't guaranteed the event handling to be complete
     */
    await sleep(500);

    // snapshot reply messages
    expect(lineClient.mock.calls).toMatchSnapshot();
    // snapshot user context
    expect(redis.set.mock.calls).toMatchSnapshot();

    return new Promise((resolve, reject) => {
      server.close(error => {
        if (error) return reject(error);
        resolve();
      });
    });
  });
});

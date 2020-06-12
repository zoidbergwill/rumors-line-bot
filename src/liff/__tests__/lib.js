beforeEach(() => {
  jest.resetModules();
});

it('isDuringLiffRedirect reacts to URL search string', () => {
  global.location = {
    search: '?liff.state=foo',
  };
  let lib = require('../lib');
  expect(lib.isDuringLiffRedirect).toBe(true);
  jest.resetModules();

  global.location = {
    search: '?foo=bar',
  };
  lib = require('../lib');
  expect(lib.isDuringLiffRedirect).toBe(false);
});

describe('assertInClient', () => {
  afterEach(() => {
    delete global.DEBUG_LIFF;
    delete global.alert;
    delete global.liff;
  });

  it('DEBUG_LIFF works', () => {
    global.liff = {
      isInClient: jest.fn(),
    };
    global.DEBUG_LIFF = true;

    const { assertInClient } = require('../lib');
    expect(assertInClient()).toBe(undefined);
    expect(liff.isInClient).not.toHaveBeenCalled();
  });

  it('does nothing if in client', () => {
    global.liff = {
      isInClient: jest.fn().mockImplementation(() => true),
      closeWindow: jest.fn(),
    };
    global.DEBUG_LIFF = undefined;

    const { assertInClient } = require('../lib');
    expect(assertInClient()).toBe(undefined);
    expect(liff.isInClient).toHaveBeenCalledTimes(1);
    expect(liff.closeWindow).not.toHaveBeenCalled();
  });

  it('alerts and closes window if not in client', () => {
    global.liff = {
      isInClient: jest.fn().mockImplementation(() => false),
      closeWindow: jest.fn(),
    };
    global.alert = jest.fn();
    global.DEBUG_LIFF = undefined;

    const { assertInClient } = require('../lib');
    expect(assertInClient()).toBe(undefined);
    expect(liff.isInClient).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          "Sorry, the function is not applicable on desktop.
      Please proceed on your mobile phone. 📲 ",
        ],
      ]
    `);
    expect(liff.closeWindow).toHaveBeenCalledTimes(1);
  });
});

describe('assertSameSearchSession', () => {
  afterEach(() => {
    delete global.location;
    delete global.alert;
    delete global.liff;
    delete global.atob;
    delete global.fetch;
    delete global.rollbar;
  });

  it('closes window if no token given in URL', async () => {
    global.location = {
      search: '', // No token
    };
    global.liff = { closeWindow: jest.fn() };
    global.alert = jest.fn();

    const { assertSameSearchSession } = require('../lib');
    await expect(assertSameSearchSession()).resolves.toBe(undefined);
    expect(alert.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          "Cannot get token from URL",
        ],
      ]
    `);
    expect(liff.closeWindow).toHaveBeenCalledTimes(1);
  });

  it('closes window if URL token is expired', async () => {
    global.location = {
      search: `?token=foo.bar`, // Has token
    };
    global.liff = { closeWindow: jest.fn() };
    global.alert = jest.fn();
    global.atob = () => JSON.stringify({ exp: Date.now() / 1000 - 10 }); // return expired time

    const { assertSameSearchSession } = require('../lib');
    await expect(assertSameSearchSession()).resolves.toBe(undefined);

    expect(alert.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          "Sorry, the button is expired.",
        ],
      ]
    `);
    expect(liff.closeWindow).toHaveBeenCalledTimes(1);
  });

  it('closes window if graphql call errors with invalid auth header', async () => {
    global.location = {
      search: `?token=foo.bar`, // Has token
    };
    global.liff = { closeWindow: jest.fn() };
    global.alert = jest.fn();
    global.atob = () => JSON.stringify({ exp: Date.now() / 1000 + 10 }); // not-expired time
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            data: null,
            errors: [{ message: 'Invalid authentication header' }],
          }),
      })
    );
    global.rollbar = { error: jest.fn() };

    const { assertSameSearchSession } = require('../lib');
    await expect(assertSameSearchSession()).resolves.toBe(undefined);
    expect(fetch.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          "/graphql",
          Object {
            "body": "{\\"query\\":\\"\\\\n    query CheckSessionId {\\\\n      context {\\\\n        data {\\\\n          sessionId\\\\n        }\\\\n      }\\\\n    }\\\\n  \\"}",
            "headers": Object {
              "Authorization": "Bearer foo.bar",
              "Content-Type": "application/json",
            },
            "method": "POST",
          },
        ],
      ]
    `);
    expect(alert.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          "This button was for previous search and is now expired.",
        ],
      ]
    `);
    expect(liff.closeWindow).toHaveBeenCalledTimes(1);
  });

  it('handles unexpected weird error, where no context data is retrieved', async () => {
    global.location = {
      search: `?token=foo.bar`, // Has token
    };
    global.liff = { closeWindow: jest.fn() };
    global.alert = jest.fn();
    global.atob = () => JSON.stringify({ exp: Date.now() / 1000 + 10 }); // not-expired time

    const { assertSameSearchSession } = require('../lib');

    // All variations of incorrect GraphQL response
    const incorrectFetchedData = [
      { data: null },
      { data: { context: null } },
      { data: { context: { data: null } } },
      { data: { context: { data: { sessionId: null } } } },
    ];

    for (const fetchedData of incorrectFetchedData) {
      alert.mockClear();
      liff.closeWindow.mockClear();

      global.fetch = jest.fn().mockImplementation(() =>
        Promise.resolve({
          json: () => Promise.resolve(fetchedData),
        })
      );

      await expect(assertSameSearchSession()).resolves.toBe(undefined);

      expect(alert.mock.calls[0][0]).toBe(
        'Unexpected error, no search session data is retrieved.'
      );
      expect(liff.closeWindow).toHaveBeenCalledTimes(1);
    }
  });
});

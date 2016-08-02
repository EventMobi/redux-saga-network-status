jest.unmock('../actions');
jest.unmock('../actionTypes');
jest.unmock('../sagas');

import fetch from 'isomorphic-fetch';
import { delay } from 'redux-saga';
import {
  call,
  cancel,
  cancelled,
  fork,
  join,
  put,
  race,
  take,
} from 'redux-saga/effects';
import { createMockTask } from 'redux-saga/utils';

import { once } from '../utils';
import {
  backoff,
  backoffComplete,
  countDown,
  navigatorOffline,
  navigatorOnline,
  ping,
  pingCancel,
  pingFailure,
  pingPending,
  pingSuccess,
} from '../actions';
import {
  BACKOFF,
  BACKOFF_COMPLETE,
  NAVIGATOR_OFFLINE,
  NAVIGATOR_ONLINE,
  PING,
  PING_CANCEL,
  PING_FAILURE,
  PING_SUCCESS,
  START_WATCH_NETWORK_STATUS,
} from '../actionTypes';
import watchNetworkStatus, {
  getNextFibonacciValue,
  handleBackoff,
  handlePing,
  fibonacciPoll,
  watchBackoff,
  watchNavigatorStatus,
  watchPing,
  watchWindowOnline,
  watchWindowOffline,
} from '../sagas';

describe('watchWindowOffline', () => {
  it('should dispatch NAVIGATOR_OFFLINE whenever the `window` \'offline\' event occurs', () => {
    const generator = watchWindowOffline();
    expect(generator.next().value).toEqual(call(once, window, 'offline'));
    expect(generator.next().value).toEqual(put(navigatorOffline()));

    expect(generator.next().value).toEqual(call(once, window, 'offline'));
    expect(generator.next().value).toEqual(put(navigatorOffline()));
  });
});

describe('watchWindowOnline', () => {
  it('should dispatch NAVIGATOR_ONLINE whenever the `window` \'online\' event occurs', () => {
    const generator = watchWindowOnline();
    expect(generator.next().value).toEqual(call(once, window, 'online'));
    expect(generator.next().value).toEqual(put(navigatorOnline()));

    expect(generator.next().value).toEqual(call(once, window, 'online'));
    expect(generator.next().value).toEqual(put(navigatorOnline()));
  });
});

describe('watchNavigatorStatus', () => {
  it('should immediately dispatch NAVIGATOR_ONLINE if `navigator.onLine`', () => {
    const generator = watchNavigatorStatus({ onLine: true });
    expect(generator.next().value).toEqual(put(navigatorOnline()));
    expect(generator.next().value).toEqual(fork(watchWindowOnline));
    expect(generator.next().value).toEqual(fork(watchWindowOffline));
  });

  it('should immediately dispatch NAVIGATOR_OFFLINE if `!navigator.onLine`', () => {
    const generator = watchNavigatorStatus({ onLine: false });
    expect(generator.next().value).toEqual(put(navigatorOffline()));
    expect(generator.next().value).toEqual(fork(watchWindowOnline));
    expect(generator.next().value).toEqual(fork(watchWindowOffline));
  });
});

describe('handlePing', () => {
  it('should complete immediately if PING_CANCEL is given', () => {
    const generator = handlePing({ type: PING_CANCEL });
    expect(generator.next().done).toBe(true);
  });

  it('should ping with `fetch`, then dispatch PING_SUCCESS upon successful response', () => {
    const generator = handlePing({ type: PING, payload: 'http://example.com/ping' });
    expect(generator.next().value).toEqual(put(pingPending()));
    expect(generator.next().value).toEqual(fork(delay, 1000));
    const delayTask = createMockTask();
    expect(generator.next(delayTask).value).toEqual(race({
      ping: call(fetch, 'http://example.com/ping'),
      timeout: call(delay, 5000),
    }));
    expect(generator.next({ ping: { ok: true } }).value).toEqual(put(pingSuccess()));
    expect(generator.next().value).toEqual(cancelled());
    expect(generator.next(false).done).toBe(true);
  });

  it('should ping with `fetch`, then dispatch PING_FAILURE upon HTTP error response', () => {
    const generator = handlePing({ type: PING, payload: 'http://example.com/ping' });
    expect(generator.next().value).toEqual(put(pingPending()));
    expect(generator.next().value).toEqual(fork(delay, 1000));
    const delayTask = createMockTask();
    expect(generator.next(delayTask).value).toEqual(race({
      ping: call(fetch, 'http://example.com/ping'),
      timeout: call(delay, 5000),
    }));
    expect(generator.next({ ping: { ok: false } }).value).toEqual(join(delayTask));
    expect(generator.next().value).toEqual(put(pingFailure()));
    expect(generator.next().value).toEqual(cancelled());
    expect(generator.next(false).done).toBe(true);
  });

  it('should ping with `fetch`, then dispatch PING_FAILURE upon generic error', () => {
    const generator = handlePing({ type: PING, payload: 'http://example.com/ping' });
    expect(generator.next().value).toEqual(put(pingPending()));
    expect(generator.next().value).toEqual(fork(delay, 1000));
    const delayTask = createMockTask();
    expect(generator.next(delayTask).value).toEqual(race({
      ping: call(fetch, 'http://example.com/ping'),
      timeout: call(delay, 5000),
    }));
    expect(generator.throw(new Error()).value).toEqual(join(delayTask));
    expect(generator.next().value).toEqual(put(pingFailure()));
    expect(generator.next().value).toEqual(cancelled());
    expect(generator.next(false).done).toBe(true);
  });

  it('should ping with `fetch`, then immediately dispatch PING_FAILURE upon cancellation', () => {
    const generator = handlePing({ type: PING, payload: 'http://example.com/ping' });
    expect(generator.next().value).toEqual(put(pingPending()));
    expect(generator.next().value).toEqual(fork(delay, 1000));
    const delayTask = createMockTask();
    expect(generator.next(delayTask).value).toEqual(race({
      ping: call(fetch, 'http://example.com/ping'),
      timeout: call(delay, 5000),
    }));
    expect(generator.return().value).toEqual(cancelled());
    expect(generator.next(true).value).toEqual(put(pingFailure()));
    expect(generator.next().done).toBe(true);
  });
});

describe('watchPing', () => {
  it('should call `handlePing` upon PING actions', () => {
    const generator = watchPing();
    expect(generator.next().value).toEqual(take([PING, PING_CANCEL]));
    const action = { type: PING, payload: 'http://example.com/ping' };
    expect(generator.next(action).value).toEqual(fork(handlePing, action));
  });

  it('should call `handlePing` upon PING_CANCEL actions', () => {
    const generator = watchPing();
    expect(generator.next().value).toEqual(take([PING, PING_CANCEL]));
    const action = { type: PING_CANCEL };
    expect(generator.next(action).value).toEqual(fork(handlePing, action));
  });
});

describe('handleBackoff', () => {
  it('should complete immediately if a payload of 0 is given', () => {
    const generator = handleBackoff({ type: BACKOFF, payload: 0 });
    expect(generator.next().value).toEqual(put(backoffComplete()));
    expect(generator.next().done).toBe(true);
  });

  it('should dispatch COUNT_DOWN for each second of the given payload', () => {
    const generator = handleBackoff({ type: BACKOFF, payload: 2000 });

    expect(generator.next().value).toEqual(put(countDown(1000)));
    expect(generator.next().value).toEqual(call(delay, 1000));
    // 1000

    expect(generator.next().value).toEqual(put(countDown(1000)));
    expect(generator.next().value).toEqual(call(delay, 1000));
    // 0

    expect(generator.next().value).toEqual(put(backoffComplete()));
    expect(generator.next().done).toBe(true);
  });

  it('should dispatch COUNT_DOWN using the remaining milliseconds if any', () => {
    const generator = handleBackoff({ type: BACKOFF, payload: 2500 });

    expect(generator.next().value).toEqual(put(countDown(1000)));
    expect(generator.next().value).toEqual(call(delay, 1000));
    // 1500

    expect(generator.next().value).toEqual(put(countDown(1000)));
    expect(generator.next().value).toEqual(call(delay, 1000));
    // 500

    expect(generator.next().value).toEqual(put(countDown(500)));
    expect(generator.next().value).toEqual(call(delay, 500));
    // 0

    expect(generator.next().value).toEqual(put(backoffComplete()));
    expect(generator.next().done).toBe(true);
  });
});

describe('watchBackoff', () => {
  it('should call `handleBackoff` upon BACKOFF actions', () => {
    const generator = watchBackoff();
    expect(generator.next().value).toEqual(take(BACKOFF));
    expect(generator.next({ type: BACKOFF }).value).toEqual(fork(handleBackoff, { type: BACKOFF }));
  });
});

describe('getNextFibonacciValue', () => {
  it('should compute the next fibonacci value with no randomization factor', () => {
    expect(getNextFibonacciValue(0, 2, 3)).toBe(5);
    expect(getNextFibonacciValue(0, 3, 5)).toBe(8);
    expect(getNextFibonacciValue(0, 5, 8)).toBe(13);
  });

  it('should compute the next fibonacci value with a randomization factor of 1', () => {
    const originalRandom = Math.random;
    try {
      Math.random = () => 0;
      expect(getNextFibonacciValue(1, 2, 3)).toBe(5);

      Math.random = () => 0.4;
      expect(getNextFibonacciValue(1, 2, 3)).toBe(7);

      Math.random = () => 1;
      expect(getNextFibonacciValue(1, 2, 3)).toBe(10);
    } finally {
      Math.random = originalRandom;
    }
  });

  it('should compute the next fibonacci value with a randomization factor of 0.5', () => {
    const originalRandom = Math.random;
    try {
      Math.random = () => 0;
      expect(getNextFibonacciValue(0.5, 2, 3)).toBe(5);

      Math.random = () => 0.4;
      expect(getNextFibonacciValue(0.5, 2, 3)).toBe(6);

      Math.random = () => 1;
      expect(getNextFibonacciValue(0.5, 2, 3)).toBe(7.5);
    } finally {
      Math.random = originalRandom;
    }
  });
});

describe('fibonacciPoll', () => {
  it('should dispatch a PING, then complete upon PING_SUCCESS', () => {
    const generator = fibonacciPoll('http://example.com/ping', {
      randomizationFactor: 0.5,
      initialDelay: 500,
      maxDelay: 10000,
    });
    expect(generator.next().value).toEqual(put(ping('http://example.com/ping')));
    expect(generator.next().value).toEqual(take([PING_SUCCESS, PING_FAILURE]));

    // Simulate PING_SUCCESS:
    expect(generator.next({ type: PING_SUCCESS }).value).toEqual(cancelled());
    expect(generator.next(false).done).toBe(true);
  });

  it(
    'should dispatch a PING, then upon PING_FAILURE, ' +
    'BACKOFF, then ping again upon BACKOFF_COMPLETE',
    () => {
      const generator = fibonacciPoll('http://example.com/ping', {
        randomizationFactor: 0.5,
        initialDelay: 500,
        maxDelay: 10000,
      });
      expect(generator.next().value).toEqual(put(ping('http://example.com/ping')));
      expect(generator.next().value).toEqual(take([PING_SUCCESS, PING_FAILURE]));

      // Simulate PING_FAILURE:
      expect(generator.next({ type: PING_FAILURE }).value).toEqual(put(backoff(500)));
      expect(generator.next().value).toEqual(race({
        backoffComplete: take(BACKOFF_COMPLETE),
        ping: take(PING),
      }));

      // Simulate BACKOFF_COMPLETE:
      const winner = { backoffComplete: { type: BACKOFF_COMPLETE } };
      expect(generator.next(winner).value).toEqual(put(ping('http://example.com/ping')));
    }
  );

  it(
    'should dispatch a PING, then upon PING_FAILURE, ' +
    'BACKOFF, then upon PING, wait for PING_SUCCESS or PING_FAILURE',
    () => {
      const generator = fibonacciPoll('http://example.com/ping', {
        randomizationFactor: 0.5,
        initialDelay: 500,
        maxDelay: 10000,
      });
      expect(generator.next().value).toEqual(put(ping('http://example.com/ping')));
      expect(generator.next().value).toEqual(take([PING_SUCCESS, PING_FAILURE]));

      // Simulate PING_FAILURE:
      expect(generator.next({ type: PING_FAILURE }).value).toEqual(put(backoff(500)));
      expect(generator.next().value).toEqual(race({
        backoffComplete: take(BACKOFF_COMPLETE),
        ping: take(PING),
      }));

      // Simulate PING:
      const winner = { ping: { type: PING } };
      expect(generator.next(winner).value).toEqual(take([PING_SUCCESS, PING_FAILURE]));
    }
  );

  it('should delay subsequent ping attempts using increasing fibonacci time intervals', () => {
    const generator = fibonacciPoll('http://example.com/ping', {
      randomizationFactor: 0,
      initialDelay: 500,
      maxDelay: 10000,
    });
    expect(generator.next().value).toEqual(put(ping('http://example.com/ping')));
    expect(generator.next().value).toEqual(take([PING_SUCCESS, PING_FAILURE]));

    // Simulate PING_FAILURE:
    expect(generator.next({ type: PING_FAILURE }).value).toEqual(put(backoff(500)));
    expect(generator.next().value).toEqual(race({
      backoffComplete: take(BACKOFF_COMPLETE),
      ping: take(PING),
    }));

    // Simulate BACKOFF_COMPLETE:
    let winner = { backoffComplete: { type: BACKOFF_COMPLETE } };
    expect(generator.next(winner).value).toEqual(put(ping('http://example.com/ping')));
    expect(generator.next().value).toEqual(take([PING_SUCCESS, PING_FAILURE]));

    // Simulate PING_FAILURE:
    expect(generator.next({ type: PING_FAILURE }).value).toEqual(put(backoff(500)));
    expect(generator.next().value).toEqual(race({
      backoffComplete: take(BACKOFF_COMPLETE),
      ping: take(PING),
    }));

    // Simulate BACKOFF_COMPLETE:
    winner = { backoffComplete: { type: BACKOFF_COMPLETE } };
    expect(generator.next(winner).value).toEqual(put(ping('http://example.com/ping')));
    expect(generator.next().value).toEqual(take([PING_SUCCESS, PING_FAILURE]));

    // Simulate PING_FAILURE:
    expect(generator.next({ type: PING_FAILURE }).value).toEqual(put(backoff(1000)));
    expect(generator.next().value).toEqual(race({
      backoffComplete: take(BACKOFF_COMPLETE),
      ping: take(PING),
    }));

    // Simulate BACKOFF_COMPLETE:
    winner = { backoffComplete: { type: BACKOFF_COMPLETE } };
    expect(generator.next(winner).value).toEqual(put(ping('http://example.com/ping')));
    expect(generator.next().value).toEqual(take([PING_SUCCESS, PING_FAILURE]));

    // Simulate PING_FAILURE:
    expect(generator.next({ type: PING_FAILURE }).value).toEqual(put(backoff(1500)));
    expect(generator.next().value).toEqual(race({
      backoffComplete: take(BACKOFF_COMPLETE),
      ping: take(PING),
    }));
  });

  it('should dispatch PING_CANCEL upon cancellation', () => {
    const generator = fibonacciPoll('http://example.com/ping', {
      randomizationFactor: 0,
      initialDelay: 500,
      maxDelay: 10000,
    });
    expect(generator.next().value).toEqual(put(ping('http://example.com/ping')));
    expect(generator.next().value).toEqual(take([PING_SUCCESS, PING_FAILURE]));

    // Simulate cancellation
    expect(generator.return().value).toEqual(cancelled());
    expect(generator.next(true).value).toEqual(put(pingCancel()));
  });
});

describe('watchNetworkStatus', () => {
  it(
    'should wait for a START_WATCH_NETWORK_STATUS action, then fork the network saga tasks',
    () => {
      const generator = watchNetworkStatus();
      expect(generator.next().value).toEqual(take(START_WATCH_NETWORK_STATUS));
      expect(generator.next({
        type: START_WATCH_NETWORK_STATUS,
        payload: 'http://example.com/ping',
      }).value).toEqual(fork(watchBackoff));
      expect(generator.next().value).toEqual(fork(watchPing));
      expect(generator.next().value).toEqual(fork(watchNavigatorStatus, window.navigator));
    }
  );

  it('should begin polling when NAVIGATOR_ONLINE, and stop when NAVIGATOR_OFFLINE', () => {
    const generator = watchNetworkStatus();
    expect(generator.next().value).toEqual(take(START_WATCH_NETWORK_STATUS));
    expect(generator.next({
      type: START_WATCH_NETWORK_STATUS,
      payload: 'http://example.com/ping',
    }).value).toEqual(fork(watchBackoff));
    expect(generator.next().value).toEqual(fork(watchPing));
    expect(generator.next().value).toEqual(fork(watchNavigatorStatus, window.navigator));
    expect(generator.next().value).toEqual(take(NAVIGATOR_ONLINE));
    expect(generator.next({ type: NAVIGATOR_ONLINE }).value).toEqual(fork(fibonacciPoll, 'http://example.com/ping', {
      randomizationFactor: 0.5,
      initialDelay: 500,
      maxDelay: 10000,
    }));
    const pollTask = createMockTask();
    expect(generator.next(pollTask).value).toEqual(take(NAVIGATOR_OFFLINE));

    // Simulate NAVIGATOR_OFFLINE action:
    expect(generator.next({ type: NAVIGATOR_OFFLINE }).value).toEqual(cancel(pollTask));
    // It should wait for another NAVIGATOR_ONLINE:
    expect(generator.next().value).toEqual(take(NAVIGATOR_ONLINE));

    // Simulate NAVIGATOR_ONLINE action:
    expect(generator.next({ type: NAVIGATOR_ONLINE }).value).toEqual(fork(fibonacciPoll, 'http://example.com/ping', {
      randomizationFactor: 0.5,
      initialDelay: 500,
      maxDelay: 10000,
    }));
  });
});
